import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { CommentWithAuthor } from "@/hooks/useComments"

interface Props {
  comments: CommentWithAuthor[]
  activeId: string | null
  isOwner: boolean
  currentUserId: string | undefined
  onFocus: (comment: CommentWithAuthor) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
  onDelete: (id: string) => void
}

export function CommentSidebar({
  comments,
  activeId,
  isOwner,
  currentUserId,
  onFocus,
  onResolve,
  onIgnore,
  onDelete,
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
          No comments. Select text in the editor to add a note.
        </p>
      ) : (
        <div className="space-y-2 overflow-auto pr-1">
          {comments.map((comment) => {
            const isActive = comment.id === activeId
            const canDelete = isOwner || comment.author_id === currentUserId
            return (
              <div
                key={comment.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => onFocus(comment)}
                className={cn(
                  "cursor-pointer rounded-md border p-3 transition-[transform,opacity]",
                  isActive ? "border-brand bg-brand/5" : "border-border/60 hover:border-border",
                )}
              >
                <p className="mb-1.5 truncate border-l-2 border-brand/50 pl-2 font-mono text-[0.7rem] text-muted-foreground">
                  {comment.anchored_text}
                </p>
                <p className="text-sm leading-snug">{comment.body}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    @{comment.authorName} · {formatRelativeTime(comment.created_at)}
                  </span>
                  {comment.status === "text_changed" && (
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-destructive">
                      text changed
                    </span>
                  )}
                </div>
                {(isOwner || canDelete) && (
                  <div className="mt-2 flex items-center gap-1 border-t border-border/40 pt-2">
                    {isOwner && (
                      <>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onIgnore(comment.id)
                          }}
                          className="h-6 px-2 font-mono text-[0.7rem]"
                        >
                          Ignore
                        </Button>
                      </>
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
