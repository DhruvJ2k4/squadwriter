import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useSession, type ChatMessage } from "@/hooks/useSession"
import { usePresence } from "@/hooks/usePresence"
import { CodeMirrorEditor, type Selection } from "@/components/editor/CodeMirrorEditor"
import { variableHighlighter } from "@/components/editor/VariableHighlighter"
import { DEFAULT_THEME_NAME, ThemeSelector, getThemeExtension } from "@/components/editor/ThemeSelector"
import { liveDiff } from "@/components/session/liveDiff"
import { PresenceBar } from "@/components/session/PresenceBar"
import { SessionTimer } from "@/components/session/SessionTimer"
import { ChatPanel } from "@/components/session/ChatPanel"
import { MergeView } from "@/components/session/MergeView"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

function tabLabel(section: PromptSection): string {
  if (section.section_type === "rag_json") return "JSON"
  return section.title || (section.section_type === "main" ? "Main" : "Stage")
}

/** Keep the two session editors' scroll positions in sync, by ratio (§ scroll together). */
function useSyncedScroll(
  aRef: RefObject<HTMLDivElement | null>,
  bRef: RefObject<HTMLDivElement | null>,
  rebindKey: string,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    const a = aRef.current?.querySelector<HTMLElement>(".cm-scroller")
    const b = bRef.current?.querySelector<HTMLElement>(".cm-scroller")
    if (!a || !b) return
    let lock = false
    const sync = (from: HTMLElement, to: HTMLElement) => {
      if (lock) return
      lock = true
      const max = from.scrollHeight - from.clientHeight
      const ratio = max > 0 ? from.scrollTop / max : 0
      to.scrollTop = ratio * Math.max(0, to.scrollHeight - to.clientHeight)
      requestAnimationFrame(() => {
        lock = false
      })
    }
    const onA = () => sync(a, b)
    const onB = () => sync(b, a)
    a.addEventListener("scroll", onA, { passive: true })
    b.addEventListener("scroll", onB, { passive: true })
    return () => {
      a.removeEventListener("scroll", onA)
      b.removeEventListener("scroll", onB)
    }
  }, [aRef, bRef, rebindKey, enabled])
}

export function SessionRoom({ sessionId }: { sessionId: string }) {
  const { user, profile } = useAuth()
  const {
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
    finalize,
  } = useSession(sessionId)

  const presence = usePresence(
    `session:${sessionId}:presence`,
    user && profile ? { userId: user.id, username: profile.username } : null,
  )

  const [themeName, setThemeName] = useState(DEFAULT_THEME_NAME)
  const [activeId, setActiveId] = useState<string>("")
  const [merging, setMerging] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [mySelection, setMySelection] = useState<Selection | null>(null)
  const [reveal, setReveal] = useState<{ pos: number; nonce: number } | null>(null)
  const myColRef = useRef<HTMLDivElement>(null)
  const otherColRef = useRef<HTMLDivElement>(null)

  const mySections = useMemo(
    () => myCopy.filter((s) => !s.archived).sort((a, b) => a.position - b.position),
    [myCopy],
  )

  useEffect(() => {
    if (!activeId && mySections.length) setActiveId(mySections[0].id)
  }, [activeId, mySections])

  // The other participant's live copy of the active section. Computed before any early return
  // so the diff-highlight memos below remain unconditional hooks.
  const otherParticipant = participants.find((p) => p.userId !== user?.id)
  const otherSections = otherParticipant ? (otherCopies.get(otherParticipant.userId) ?? []) : []
  const otherActive = otherSections.find((s) => s.id === activeId)
  const myActiveContent = mySections.find((s) => s.id === activeId)?.content ?? ""
  const otherActiveContent = otherActive?.content ?? ""

  // §2.7 — each editor highlights its own spans that diverge from the other working copy.
  const myExtras = useMemo(
    () => [variableHighlighter(), liveDiff(otherActiveContent, "added")],
    [otherActiveContent],
  )
  const otherExtras = useMemo(
    () => [variableHighlighter(), liveDiff(myActiveContent, "removed")],
    [myActiveContent],
  )

  // §1 — scroll both working copies together.
  useSyncedScroll(myColRef, otherColRef, `${activeId}-${otherParticipant?.userId ?? "none"}`, !!otherParticipant)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-mono text-xs text-muted-foreground">Joining session…</span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="font-display text-2xl">Session not found.</p>
        <Link to="/" className="font-mono text-xs text-brand hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const amParticipant = participants.some((p) => p.userId === user?.id)
  const theme = getThemeExtension(themeName)
  const ended = session.status === "ended"

  function editActive(content: string) {
    saveWorkingCopy(myCopy.map((s) => (s.id === activeId ? { ...s, content } : s)))
  }

  // §2.7 — drop the current selection into chat as a quoted reference (clickable to jump back).
  function commentSelectionToChat() {
    if (!mySelection) return
    const text = myActiveContent.slice(mySelection.from, mySelection.to)
    if (!text.trim()) return
    sendChat("", { quote: text, quoteSectionId: activeId, quoteFrom: mySelection.from })
    setMySelection(null)
  }

  // Clicking a quoted reference in chat jumps to that line in your copy.
  function jumpToQuote(m: ChatMessage) {
    if (m.quoteSectionId && mySections.some((s) => s.id === m.quoteSectionId)) {
      setActiveId(m.quoteSectionId)
    }
    if (m.quoteFrom !== undefined) {
      setReveal((r) => ({ pos: m.quoteFrom as number, nonce: (r?.nonce ?? 0) + 1 }))
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            to={`/prompts/${session.prompt_id}`}
            className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Leave
          </Link>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-brand">Live session</span>
          <PresenceBar users={presence} />
        </div>
        <SessionTimer
          endsAt={session.ends_at}
          ended={ended}
          isHost={isHost}
          onExtend={(m) => void extend(m)}
          onEnd={() => setMerging(true)}
          onExpire={() => {
            if (isHost) setMerging(true)
          }}
        />
      </header>

      {!amParticipant ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="font-display text-xl">You're not part of this session.</p>
          <Link to={`/prompts/${session.prompt_id}`} className="font-mono text-xs text-brand hover:underline">
            Back to prompt
          </Link>
        </div>
      ) : ended ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="font-display text-2xl">Session ended.</p>
          <p className="font-mono text-xs text-muted-foreground">
            The result was merged into a new version of the prompt.
          </p>
          <Link to={`/prompts/${session.prompt_id}`} className="mt-2 font-mono text-xs text-brand hover:underline">
            Back to prompt
          </Link>
        </div>
      ) : (
        <main className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {mySections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveId(s.id)
                      setMySelection(null)
                    }}
                    className={cn(
                      "relative px-3 py-1.5 font-mono text-xs",
                      s.id === activeId ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tabLabel(s)}
                    {s.id === activeId && (
                      <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
                    )}
                  </button>
                ))}
              </div>
              <ThemeSelector value={themeName} onChange={setThemeName} />
            </div>

            {otherParticipant && (
              <div className="mb-2 flex items-center gap-4 font-mono text-[0.6rem] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-emerald-500/40" /> your additions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-destructive/40" /> only in their copy
                </span>
              </div>
            )}

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <div ref={myColRef} className="flex min-h-0 flex-col">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brand">You</p>
                  {mySelection && (
                    <button
                      onClick={commentSelectionToChat}
                      className="flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground transition-opacity hover:text-brand"
                    >
                      <MessageSquare className="size-3" />
                      Comment on selection
                    </button>
                  )}
                </div>
                <CodeMirrorEditor
                  key={`me-${activeId}`}
                  value={myActiveContent}
                  onChange={editActive}
                  editable
                  language="markdown"
                  themeExtension={theme}
                  extraExtensions={myExtras}
                  onSelectionChange={setMySelection}
                  revealPos={reveal?.pos}
                  revealNonce={reveal?.nonce}
                  className="flex-1 overflow-auto rounded-md border border-border/60"
                />
              </div>
              <div ref={otherColRef} className="flex min-h-0 flex-col">
                <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {otherParticipant ? `@${otherParticipant.username}` : "Waiting for a partner…"}
                </p>
                <CodeMirrorEditor
                  key={`other-${activeId}-${otherParticipant?.userId ?? "none"}`}
                  value={otherActiveContent}
                  editable={false}
                  language="markdown"
                  themeExtension={theme}
                  extraExtensions={otherExtras}
                  className="flex-1 overflow-auto rounded-md border border-border/60"
                />
              </div>
            </div>
          </div>

          <aside className="hidden w-80 shrink-0 border-l border-border/60 p-4 md:block">
            <ChatPanel messages={messages} currentUserId={user?.id} onSend={sendChat} onQuoteClick={jumpToQuote} />
          </aside>
        </main>
      )}

      {isHost && (
        <MergeView
          open={merging}
          hostSections={myCopy}
          otherSections={otherSections}
          otherName={otherParticipant?.username ?? "partner"}
          busy={finalizing}
          onCancel={() => setMerging(false)}
          onFinalize={async (merged) => {
            setFinalizing(true)
            const res = await finalize(merged)
            setFinalizing(false)
            if (!res.error) setMerging(false)
          }}
        />
      )}
    </div>
  )
}
