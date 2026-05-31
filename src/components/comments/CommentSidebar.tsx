import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SuggestionCard } from "@/components/comments/SuggestionCard"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { CommentWithAuthor, ReplyWithAuthor } from "@/hooks/useComments"

interface Props {
  comments: CommentWithAuthor[]
  repliesByComment: Map<string, ReplyWithAuthor[]>
  activeId: string | null
  isOwner: boolean
  canReply: boolean
  currentUserId: string | undefined
  onFocus: (comment: CommentWithAuthor) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
  onApply: (comment: CommentWithAuthor) => void
  onDelete: (id: string) => void
  onReply: (commentId: string, body: string) => Promise<{ error: string | null }>
}

function ReplyThread({
  replies,
  canReply,
  onReply,
}: {
  replies: ReplyWithAuthor[]
  canReply: boolean
  onReply: (body: string) => Promise<{ error: string | null }>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!text.trim()) return
    setBusy(true)
    const res = await onReply(text)
    setBusy(false)
    if (!res.error) {
      setText("")
      setOpen(false)
    }
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
      {replies.map((reply) => (
        <div key={reply.id} className="text-xs">
          <span className="font-mono text-[0.65rem] text-brand">@{reply.authorName}</span>{" "}
          <span className="font-mono text-[0.6rem] text-muted-foreground">
            {formatRelativeTime(reply.created_at)}
          </span>
          <p className="leading-snug text-foreground/90">{reply.body}</p>
        </div>
      ))}
      {canReply &&
        (open ? (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reply…"
              rows={2}
              autoFocus
              className="text-sm focus-visible:border-brand focus-visible:ring-brand/25"
            />
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 font-mono text-[0.7rem]" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={busy || !text.trim()}
                onClick={() => void send()}
                className="h-6 bg-brand px-2 font-mono text-[0.7rem] text-brand-foreground hover:bg-brand/90"
              >
                Reply
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
            className="font-mono text-[0.7rem] text-muted-foreground hover:text-foreground"
          >
            Reply
          </button>
        ))}
    </div>
  )
}

export function CommentSidebar({
  comments,
  repliesByComment,
  activeId,
  isOwner,
  canReply,
  currentUserId,
  onFocus,
  onResolve,
  onIgnore,
  onApply,
  onDelete,
  onReply,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (activeId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [activeId])

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
        Comments · {comments.length}
      </p>
      {comments.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">
          No comments. Select text in the editor to add a note or suggestion.
        </p>
      ) : (
        <div className="space-y-2 overflow-auto pr-1">
          <AnimatePresence initial={false}>
            {comments.map((comment) => {
              const isActive = comment.id === activeId
              const canDelete = isOwner || comment.author_id === currentUserId
              const isSuggestion = comment.comment_type === "suggestion"
              return (
                <motion.div
                  key={comment.id}
                  ref={isActive ? activeRef : undefined}
                  layout={false}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onClick={() => onFocus(comment)}
                  className={cn(
                    "cursor-pointer rounded-md border p-3",
                    isActive ? "border-brand bg-brand/5" : "border-border/60 hover:border-border",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                      {isSuggestion ? "Suggestion" : "Note"}
                    </span>
                    {comment.status === "text_changed" && (
                      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-destructive">
                        text changed
                      </span>
                    )}
                  </div>

                  {isSuggestion ? (
                    <SuggestionCard
                      anchoredText={comment.anchored_text}
                      proposed={comment.body}
                      canApply={isOwner}
                      onApply={() => onApply(comment)}
                      onIgnore={() => onIgnore(comment.id)}
                    />
                  ) : (
                    <>
                      <p className="mb-1.5 truncate border-l-2 border-brand/50 pl-2 font-mono text-[0.7rem] text-muted-foreground">
                        {comment.anchored_text}
                      </p>
                      <p className="text-sm leading-snug">{comment.body}</p>
                    </>
                  )}

                  <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">
                    @{comment.authorName} · {formatRelativeTime(comment.created_at)}
                  </p>

                  <ReplyThread
                    replies={repliesByComment.get(comment.id) ?? []}
                    canReply={canReply}
                    onReply={(body) => onReply(comment.id, body)}
                  />

                  {(isOwner || canDelete) && (
                    <div className="mt-2 flex items-center gap-1 border-t border-border/40 pt-2">
                      {isOwner && !isSuggestion && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onResolve(comment.id)
                          }}
                          className="h-6 px-2 font-mono text-[0.7rem]"
                        >
                          Resolve
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(comment.id)
                          }}
                          className="ml-auto h-6 px-2 font-mono text-[0.7rem] text-muted-foreground hover:text-destructive"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
