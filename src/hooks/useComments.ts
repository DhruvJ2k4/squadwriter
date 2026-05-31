import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { AnchorReport } from "@/components/comments/CommentLayer"
import type { Comment, CommentStatus } from "@/lib/types"

export type CommentWithAuthor = Comment & { authorName: string }

type CreateNoteArgs = {
  sectionId: string
  anchorStart: number
  anchorEnd: number
  anchoredText: string
  body: string
}

/** Active comments live on the canvas; resolved/ignored are removed from view. */
const ACTIVE_STATUSES: CommentStatus[] = ["open", "text_changed"]

export function useComments(promptId: string | undefined) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)

  const pendingDeleted = useRef<Set<string>>(new Set())
  const pendingPos = useRef<Map<string, AnchorReport>>(new Map())
  const flushTimer = useRef<number | undefined>(undefined)

  const refetch = useCallback(async () => {
    if (!promptId) return
    setLoading(true)
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("prompt_id", promptId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true })
    const rows = data ?? []
    const authorIds = [...new Set(rows.map((c) => c.author_id))]
    let names = new Map<string, string>()
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", authorIds)
      names = new Map((profiles ?? []).map((p) => [p.id, p.username]))
    }
    setComments(rows.map((c) => ({ ...c, authorName: names.get(c.author_id) ?? "unknown" })))
    setLoading(false)
  }, [promptId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createNote = useCallback(
    async (args: CreateNoteArgs): Promise<{ error: string | null }> => {
      if (!user || !promptId) return { error: "Not ready." }
      const { data: latest } = await supabase
        .from("prompt_versions")
        .select("id")
        .eq("prompt_id", promptId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!latest) return { error: "Save a version before adding comments." }

      const { error } = await supabase.from("comments").insert({
        prompt_id: promptId,
        version_id: latest.id,
        section_id: args.sectionId,
        author_id: user.id,
        comment_type: "note",
        anchor_start: args.anchorStart,
        anchor_end: args.anchorEnd,
        anchored_text: args.anchoredText,
        body: args.body,
        status: "open",
      })
      if (error) return { error: error.message }
      await refetch()
      return { error: null }
    },
    [user, promptId, refetch],
  )

  /** owner resolves / ignores → comment leaves the active set. */
  const setStatus = useCallback(async (id: string, status: CommentStatus) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase.from("comments").update({ status }).eq("id", id)
  }, [])

  const remove = useCallback(async (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase.from("comments").delete().eq("id", id)
  }, [])

  const flush = useCallback(async () => {
    const deleted = [...pendingDeleted.current]
    pendingDeleted.current.clear()
    const positions = new Map(pendingPos.current)
    pendingPos.current.clear()

    for (const id of deleted) {
      await supabase.from("comments").delete().eq("id", id)
    }
    for (const [id, report] of positions) {
      await supabase
        .from("comments")
        .update({
          anchor_start: report.from,
          anchor_end: report.to,
          status: report.textChanged ? "text_changed" : "open",
        })
        .eq("id", id)
    }
  }, [])

  /** Called by the editor after each doc change with mapped positions + deletions. */
  const reportAnchors = useCallback(
    (reports: AnchorReport[], deletedIds: string[]) => {
      for (const id of deletedIds) {
        pendingDeleted.current.add(id)
        pendingPos.current.delete(id)
      }
      for (const report of reports) {
        if (!pendingDeleted.current.has(report.id)) pendingPos.current.set(report.id, report)
      }
      // Optimistic local sync: drop deleted, reflect text_changed flags in the sidebar.
      setComments((prev) =>
        prev
          .filter((c) => !deletedIds.includes(c.id))
          .map((c) => {
            const report = pendingPos.current.get(c.id)
            if (!report) return c
            const status: CommentStatus = report.textChanged ? "text_changed" : "open"
            return c.status === status ? c : { ...c, status }
          }),
      )
      if (flushTimer.current) window.clearTimeout(flushTimer.current)
      flushTimer.current = window.setTimeout(() => void flush(), 700)
    },
    [flush],
  )

  return { comments, loading, refetch, createNote, setStatus, remove, reportAnchors }
}
