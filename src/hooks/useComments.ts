import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { AnchorReport } from "@/components/comments/CommentLayer"
import type { Comment, CommentReply, CommentStatus, CommentType } from "@/lib/types"

export type CommentWithAuthor = Comment & { authorName: string }
export type ReplyWithAuthor = CommentReply & { authorName: string }

type CreateArgs = {
  sectionId: string
  anchorStart: number
  anchorEnd: number
  anchoredText: string
  body: string
  type: CommentType
}

/** Active comments live on the canvas; resolved/ignored/applied are removed from view. */
const ACTIVE_STATUSES: CommentStatus[] = ["open", "text_changed"]

/** Map a position through a [start,end)->replacement splice (delta = newLen - (end-start)). */
function remapPos(pos: number, start: number, end: number, delta: number): number {
  if (pos <= start) return pos
  if (pos >= end) return pos + delta
  return start
}

export function useComments(promptId: string | undefined) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [repliesByComment, setRepliesByComment] = useState<Map<string, ReplyWithAuthor[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const commentsRef = useRef<CommentWithAuthor[]>([])
  commentsRef.current = comments
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
    const ids = rows.map((c) => c.id)

    const { data: replyRows } = ids.length
      ? await supabase.from("comment_replies").select("*").in("comment_id", ids).order("created_at")
      : { data: [] as CommentReply[] }
    const replies = replyRows ?? []

    const authorIds = [...new Set([...rows.map((c) => c.author_id), ...replies.map((r) => r.author_id)])]
    let names = new Map<string, string>()
    if (authorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", authorIds)
      names = new Map((profiles ?? []).map((p) => [p.id, p.username]))
    }

    const grouped = new Map<string, ReplyWithAuthor[]>()
    for (const r of replies) {
      const list = grouped.get(r.comment_id) ?? []
      list.push({ ...r, authorName: names.get(r.author_id) ?? "unknown" })
      grouped.set(r.comment_id, list)
    }
    setRepliesByComment(grouped)
    setComments(rows.map((c) => ({ ...c, authorName: names.get(c.author_id) ?? "unknown" })))
    setLoading(false)
  }, [promptId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createComment = useCallback(
    async (args: CreateArgs): Promise<{ error: string | null }> => {
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
        comment_type: args.type,
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

  const setStatus = useCallback(async (id: string, status: CommentStatus) => {
    pendingPos.current.delete(id)
    pendingDeleted.current.delete(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase.from("comments").update({ status }).eq("id", id)
  }, [])

  const remove = useCallback(async (id: string) => {
    pendingPos.current.delete(id)
    pendingDeleted.current.delete(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
    await supabase.from("comments").delete().eq("id", id)
  }, [])

  /** Owner applies a suggestion: replace its span in the section, mark applied,
   *  and remap the other comments in that section. Returns the new section content. */
  const applySuggestion = useCallback(
    async (comment: Comment, oldContent: string): Promise<{ error: string | null; newContent?: string }> => {
      const start = comment.anchor_start
      const end = comment.anchor_end
      const replacement = comment.body
      const newContent = oldContent.slice(0, start) + replacement + oldContent.slice(end)
      const delta = replacement.length - (end - start)

      const { error } = await supabase
        .from("prompt_sections")
        .update({ content: newContent })
        .eq("id", comment.section_id)
      if (error) return { error: error.message }

      pendingPos.current.delete(comment.id)
      await supabase.from("comments").update({ status: "applied" }).eq("id", comment.id)

      // Remap the other active comments in the same section through the splice.
      const others = commentsRef.current.filter(
        (c) => c.section_id === comment.section_id && c.id !== comment.id,
      )
      for (const c of others) {
        const ns = remapPos(c.anchor_start, start, end, delta)
        const ne = remapPos(c.anchor_end, start, end, delta)
        if (ne <= ns) {
          await supabase.from("comments").delete().eq("id", c.id)
          continue
        }
        const overlapped = c.anchor_start < end && c.anchor_end > start
        await supabase
          .from("comments")
          .update({
            anchor_start: ns,
            anchor_end: ne,
            status: overlapped ? "text_changed" : c.status,
          })
          .eq("id", c.id)
      }

      await refetch()
      return { error: null, newContent }
    },
    [refetch],
  )

  const addReply = useCallback(
    async (commentId: string, body: string): Promise<{ error: string | null }> => {
      if (!user) return { error: "Not signed in." }
      const { error } = await supabase
        .from("comment_replies")
        .insert({ comment_id: commentId, author_id: user.id, body: body.trim() })
      if (error) return { error: error.message }
      await refetch()
      return { error: null }
    },
    [user, refetch],
  )

  const flush = useCallback(async () => {
    const deleted = [...pendingDeleted.current]
    pendingDeleted.current.clear()
    const positions = new Map(pendingPos.current)
    pendingPos.current.clear()
    for (const id of deleted) await supabase.from("comments").delete().eq("id", id)
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

  const reportAnchors = useCallback(
    (reports: AnchorReport[], deletedIds: string[]) => {
      for (const id of deletedIds) {
        pendingDeleted.current.add(id)
        pendingPos.current.delete(id)
      }
      for (const report of reports) {
        if (!pendingDeleted.current.has(report.id)) pendingPos.current.set(report.id, report)
      }
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

  return {
    comments,
    repliesByComment,
    loading,
    refetch,
    createComment,
    setStatus,
    remove,
    applySuggestion,
    addReply,
    reportAnchors,
  }
}
