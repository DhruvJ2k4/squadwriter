import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { readSnapshotSections } from "@/hooks/useVersions"
import type { Json, PromptSection, Session } from "@/lib/types"

export interface ChatMessage {
  id: string
  userId: string
  username: string
  body: string
  sticker: boolean
  ts: number
}

export interface ParticipantInfo {
  userId: string
  username: string
}

// --- standalone mutations ---------------------------------------------------

/** Host (= prompt owner) starts a session, seeds their own working copy, invites a member. */
export async function startSession(args: {
  hostId: string
  promptId: string
  sections: PromptSection[]
  inviteeId: string
  durationMinutes: number
  endsAtIso: string
}): Promise<{ error: string | null; sessionId?: string }> {
  const snapshot = { sections: args.sections } as unknown as Json
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      prompt_id: args.promptId,
      host_id: args.hostId,
      duration_minutes: args.durationMinutes,
      ends_at: args.endsAtIso,
      status: "active",
      before_snapshot: snapshot,
    })
    .select()
    .single()
  if (error || !session) return { error: error?.message ?? "Could not start session." }

  const { error: pErr } = await supabase
    .from("session_participants")
    .insert({ session_id: session.id, user_id: args.hostId, working_copy: snapshot })
  if (pErr) return { error: pErr.message }

  const { error: iErr } = await supabase
    .from("session_invites")
    .insert({ session_id: session.id, invitee_id: args.inviteeId, status: "pending" })
  if (iErr) return { error: iErr.message }

  // Live-notify the invitee on their personal channel (no DB publication needed).
  const channel = supabase.channel(`user:${args.inviteeId}`)
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void channel
        .send({ type: "broadcast", event: "invited", payload: { sessionId: session.id } })
        .then(() => supabase.removeChannel(channel))
    }
  })

  return { error: null, sessionId: session.id }
}

/** Invitee accepts → seed their working copy from the prompt's current sections. */
export async function acceptInvite(args: {
  userId: string
  sessionId: string
  inviteId: string
}): Promise<{ error: string | null }> {
  const { data: session } = await supabase
    .from("sessions")
    .select("prompt_id")
    .eq("id", args.sessionId)
    .maybeSingle()
  if (!session) return { error: "Session not found." }
  const { data: sections } = await supabase
    .from("prompt_sections")
    .select("*")
    .eq("prompt_id", session.prompt_id)
    .order("position")
  const snapshot = { sections: sections ?? [] } as unknown as Json
  const { error } = await supabase
    .from("session_participants")
    .insert({ session_id: args.sessionId, user_id: args.userId, working_copy: snapshot })
  if (error) return { error: error.message }
  await supabase.from("session_invites").update({ status: "accepted" }).eq("id", args.inviteId)
  return { error: null }
}

export async function declineInvite(inviteId: string) {
  await supabase.from("session_invites").update({ status: "declined" }).eq("id", inviteId)
}

// --- room hook --------------------------------------------------------------

export function useSession(sessionId: string | undefined) {
  const { user, profile } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [myCopy, setMyCopy] = useState<PromptSection[]>([])
  const [otherCopies, setOtherCopies] = useState<Map<string, PromptSection[]>>(new Map())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    if (!sessionId || !user) return
    setLoading(true)
    const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle()
    setSession(s ?? null)
    const { data: parts } = await supabase
      .from("session_participants")
      .select("*")
      .eq("session_id", sessionId)
    const rows = parts ?? []
    const ids = rows.map((p) => p.user_id)
    let names = new Map<string, string>()
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", ids)
      names = new Map((profiles ?? []).map((p) => [p.id, p.username]))
    }
    setParticipants(rows.map((p) => ({ userId: p.user_id, username: names.get(p.user_id) ?? "?" })))
    const others = new Map<string, PromptSection[]>()
    for (const p of rows) {
      const secs = readSnapshotSections(p.working_copy)
      if (p.user_id === user.id) setMyCopy(secs)
      else others.set(p.user_id, secs)
    }
    setOtherCopies(others)
    setLoading(false)
  }, [sessionId, user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sessionId || !user) return
    const channel = supabase.channel(`session:${sessionId}:room`, {
      config: { broadcast: { self: true } },
    })
    channel
      .on("broadcast", { event: "chat" }, ({ payload }) =>
        setMessages((m) => [...m, payload as ChatMessage]),
      )
      .on("broadcast", { event: "working_copy" }, ({ payload }) => {
        const p = payload as { userId: string; sections: PromptSection[] }
        if (p.userId !== user.id) setOtherCopies((prev) => new Map(prev).set(p.userId, p.sections))
      })
      .on("broadcast", { event: "timer" }, ({ payload }) => {
        const p = payload as { endsAt: string }
        setSession((s) => (s ? { ...s, ends_at: p.endsAt } : s))
      })
      .on("broadcast", { event: "ended" }, () => {
        setSession((s) => (s ? { ...s, status: "ended" } : s))
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [sessionId, user?.id])

  const saveWorkingCopy = useCallback(
    (sections: PromptSection[]) => {
      setMyCopy(sections)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        if (!user || !sessionId) return
        channelRef.current?.send({
          type: "broadcast",
          event: "working_copy",
          payload: { userId: user.id, sections },
        })
        void supabase
          .from("session_participants")
          .update({ working_copy: { sections } as unknown as Json })
          .eq("session_id", sessionId)
          .eq("user_id", user.id)
      }, 500)
    },
    [user, sessionId],
  )

  const sendChat = useCallback(
    (body: string, sticker = false) => {
      if (!user || !channelRef.current) return
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        userId: user.id,
        username: profile?.username ?? "you",
        body,
        sticker,
        ts: Date.now(),
      }
      void channelRef.current.send({ type: "broadcast", event: "chat", payload: msg })
    },
    [user, profile],
  )

  const extend = useCallback(
    async (minutes: number) => {
      if (!session) return
      const newEnds = new Date(new Date(session.ends_at).getTime() + minutes * 60000).toISOString()
      setSession((s) => (s ? { ...s, ends_at: newEnds } : s))
      await supabase.from("sessions").update({ ends_at: newEnds }).eq("id", session.id)
      channelRef.current?.send({ type: "broadcast", event: "timer", payload: { endsAt: newEnds } })
    },
    [session],
  )

  const end = useCallback(async () => {
    if (!session) return
    setSession((s) => (s ? { ...s, status: "ended" } : s))
    await supabase.from("sessions").update({ status: "ended" }).eq("id", session.id)
    channelRef.current?.send({ type: "broadcast", event: "ended", payload: {} })
  }, [session])

  const isHost = !!session && session.host_id === user?.id

  return {
    session,
    participants,
    myCopy,
    otherCopies,
    messages,
    loading,
    isHost,
    saveWorkingCopy,
    sendChat,
    extend,
    end,
    refetch: load,
  }
}
