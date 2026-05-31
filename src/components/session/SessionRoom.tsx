import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useSession } from "@/hooks/useSession"
import { usePresence } from "@/hooks/usePresence"
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor"
import { variableHighlighter } from "@/components/editor/VariableHighlighter"
import { DEFAULT_THEME_NAME, ThemeSelector, getThemeExtension } from "@/components/editor/ThemeSelector"
import { PresenceBar } from "@/components/session/PresenceBar"
import { SessionTimer } from "@/components/session/SessionTimer"
import { ChatPanel } from "@/components/session/ChatPanel"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

function tabLabel(section: PromptSection): string {
  if (section.section_type === "rag_json") return "JSON"
  return section.title || (section.section_type === "main" ? "Main" : "Stage")
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
    end,
  } = useSession(sessionId)

  const presence = usePresence(
    `session:${sessionId}:presence`,
    user && profile ? { userId: user.id, username: profile.username } : null,
  )

  const [themeName, setThemeName] = useState(DEFAULT_THEME_NAME)
  const extras = useMemo(() => [variableHighlighter()], [])
  const [activeId, setActiveId] = useState<string>("")

  const mySections = useMemo(
    () => myCopy.filter((s) => !s.archived).sort((a, b) => a.position - b.position),
    [myCopy],
  )

  useEffect(() => {
    if (!activeId && mySections.length) setActiveId(mySections[0].id)
  }, [activeId, mySections])

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
  const otherParticipant = participants.find((p) => p.userId !== user?.id)
  const otherSections = otherParticipant ? (otherCopies.get(otherParticipant.userId) ?? []) : []
  const otherActive = otherSections.find((s) => s.id === activeId)
  const theme = getThemeExtension(themeName)
  const ended = session.status === "ended"

  function editActive(content: string) {
    saveWorkingCopy(myCopy.map((s) => (s.id === activeId ? { ...s, content } : s)))
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
          onEnd={() => void end()}
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
          <p className="font-mono text-xs text-muted-foreground">Merge &amp; finalize arrives in Stage 12.</p>
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
                    onClick={() => setActiveId(s.id)}
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

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col">
                <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brand">You</p>
                <CodeMirrorEditor
                  key={`me-${activeId}`}
                  value={mySections.find((s) => s.id === activeId)?.content ?? ""}
                  onChange={editActive}
                  editable
                  language="markdown"
                  themeExtension={theme}
                  extraExtensions={extras}
                  className="flex-1 overflow-auto rounded-md border border-border/60"
                />
              </div>
              <div className="flex min-h-0 flex-col">
                <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {otherParticipant ? `@${otherParticipant.username}` : "Waiting for a partner…"}
                </p>
                <CodeMirrorEditor
                  key={`other-${activeId}-${otherParticipant?.userId ?? "none"}`}
                  value={otherActive?.content ?? ""}
                  editable={false}
                  language="markdown"
                  themeExtension={theme}
                  extraExtensions={extras}
                  className="flex-1 overflow-auto rounded-md border border-border/60"
                />
              </div>
            </div>
          </div>

          <aside className="hidden w-80 shrink-0 border-l border-border/60 p-4 md:block">
            <ChatPanel messages={messages} currentUserId={user?.id} onSend={sendChat} />
          </aside>
        </main>
      )}
    </div>
  )
}
