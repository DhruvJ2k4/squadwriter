import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { Smile } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/hooks/useSession"

// §2.8 — a fixed, built-in sticker set (see the note in the changeset report: admin-uploaded
// stickers would need a storage bucket + a new table, which this phase doesn't provision).
const STICKERS = ["🎉", "🔥", "👍", "✅", "❤️", "😂", "🙌", "🚀", "💡", "👀", "🤝", "🧠", "⚡", "💯", "🐛", "🎯"]

// Lazy: emoji-mart (picker + its large data set) loads only when opened.
const LazyEmojiPicker = lazy(() => import("@emoji-mart/react"))

function EmojiPicker({ onSelect }: { onSelect: (native: string) => void }) {
  const [data, setData] = useState<unknown>(null)
  useEffect(() => {
    let active = true
    void import("@emoji-mart/data").then((m) => {
      if (active) setData(m.default)
    })
    return () => {
      active = false
    }
  }, [])

  const loading = <div className="p-6 text-center font-mono text-xs text-muted-foreground">Loading…</div>
  if (!data) return loading
  return (
    <Suspense fallback={loading}>
      <LazyEmojiPicker
        data={data}
        theme="dark"
        previewPosition="none"
        onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)}
      />
    </Suspense>
  )
}

interface Props {
  messages: ChatMessage[]
  currentUserId: string | undefined
  onSend: (body: string, opts?: { sticker?: boolean; quote?: string }) => void
  /** Click a quoted reference to jump to that line in the prompt (§ live-session fix). */
  onQuoteClick?: (m: ChatMessage) => void
}

export function ChatPanel({ messages, currentUserId, onSend, onQuoteClick }: Props) {
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText("")
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/60 bg-card/30">
      <div className="border-b border-border/60 px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
        Chat
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-3">
        {messages.length === 0 && <p className="font-mono text-xs text-muted-foreground">Say hi 👋</p>}
        {messages.map((m) => {
          const mine = m.userId === currentUserId
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <span className="font-mono text-[0.6rem] text-muted-foreground">@{m.username}</span>
              {m.sticker ? (
                <span className="text-3xl leading-none">{m.body}</span>
              ) : (
                <div className={cn("flex max-w-[14rem] flex-col gap-1", mine ? "items-end" : "items-start")}>
                  {m.quote && (
                    <button
                      type="button"
                      onClick={() => onQuoteClick?.(m)}
                      disabled={!onQuoteClick}
                      title="Jump to this selection"
                      className="w-full break-words rounded-md border-l-2 border-brand/60 bg-background/50 px-2 py-1 text-left text-[0.7rem] italic text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground disabled:cursor-default"
                    >
                      “{m.quote.length > 140 ? `${m.quote.slice(0, 140)}…` : m.quote}”
                    </button>
                  )}
                  {m.body ? (
                    <span
                      className={cn(
                        "break-words rounded-lg px-2.5 py-1.5 text-sm",
                        mine ? "bg-brand text-brand-foreground" : "bg-secondary",
                      )}
                    >
                      {m.body}
                    </span>
                  ) : (
                    m.quote && (
                      <span className="font-mono text-[0.6rem] text-muted-foreground">referenced a selection</span>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-border/60 p-2">
        <div className="mb-2 flex flex-wrap gap-1">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s, { sticker: true })}
              className="rounded px-1 text-lg transition-opacity hover:opacity-70"
              aria-label={`Send ${s} sticker`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Message…"
            className="h-8 text-sm focus-visible:border-brand focus-visible:ring-brand/25"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <Smile className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-0 p-0" align="end">
              <EmojiPicker onSelect={(native) => setText((t) => t + native)} />
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={send} className="h-8 shrink-0 bg-brand text-brand-foreground hover:bg-brand/90">
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
