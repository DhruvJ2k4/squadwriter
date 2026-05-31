import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useProjects } from "@/hooks/useProjects"
import { useActivity } from "@/hooks/useActivity"
import { acceptInvite, declineInvite } from "@/hooks/useSession"
import { supabase } from "@/lib/supabase"
import { ProjectList } from "@/components/projects/ProjectList"
import { NewProjectModal } from "@/components/projects/NewProjectModal"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/ui/UserMenu"
import { formatRelativeTime } from "@/lib/utils"

interface InviteView {
  inviteId: string
  sessionId: string
  promptTitle: string
  hostName: string
}

export function Dashboard() {
  const { user } = useAuth()
  const { projects, loading, createProject, setArchived } = useProjects()
  const { items: myActivity } = useActivity({ actorId: user?.id, enabled: !!user, limit: 6 })
  const [createOpen, setCreateOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const navigate = useNavigate()
  const [invites, setInvites] = useState<InviteView[]>([])

  const loadInvites = useCallback(async () => {
    if (!user) return
    const { data: inv } = await supabase
      .from("session_invites")
      .select("id, session_id")
      .eq("invitee_id", user.id)
      .eq("status", "pending")
    const rows = inv ?? []
    if (!rows.length) {
      setInvites([])
      return
    }
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, prompt_id, host_id, status")
      .in("id", rows.map((r) => r.session_id))
    const live = (sessions ?? []).filter((s) => s.status === "active")
    const byId = new Map(live.map((s) => [s.id, s]))
    const { data: prompts } = live.length
      ? await supabase.from("prompts").select("id, title").in("id", [...new Set(live.map((s) => s.prompt_id))])
      : { data: [] as { id: string; title: string }[] }
    const { data: hosts } = live.length
      ? await supabase.from("profiles").select("id, username").in("id", [...new Set(live.map((s) => s.host_id))])
      : { data: [] as { id: string; username: string }[] }
    const titleById = new Map((prompts ?? []).map((p) => [p.id, p.title]))
    const nameById = new Map((hosts ?? []).map((h) => [h.id, h.username]))
    setInvites(
      rows
        .filter((r) => byId.has(r.session_id))
        .map((r) => {
          const s = byId.get(r.session_id)!
          return {
            inviteId: r.id,
            sessionId: r.session_id,
            promptTitle: titleById.get(s.prompt_id) ?? "a prompt",
            hostName: nameById.get(s.host_id) ?? "someone",
          }
        }),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    void loadInvites()
    const channel = supabase.channel(`user:${user.id}`)
    channel.on("broadcast", { event: "invited" }, () => void loadInvites()).subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, loadInvites])

  async function acceptSession(invite: InviteView) {
    if (!user) return
    const res = await acceptInvite({ userId: user.id, sessionId: invite.sessionId, inviteId: invite.inviteId })
    if (!res.error) navigate(`/sessions/${invite.sessionId}`)
  }

  async function declineSession(invite: InviteView) {
    await declineInvite(invite.inviteId)
    void loadInvites()
  }

  const active = projects.filter((p) => !p.archived)
  const archived = projects.filter((p) => p.archived)
  const nameById = new Map(projects.map((p) => [p.id, p.name]))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-lg font-semibold tracking-tight">SquadWriter</span>
          <span
            aria-hidden
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.1em] bg-brand animate-caret-blink"
          />
        </div>
        <UserMenu />
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto max-w-5xl px-6 py-10"
      >
        {invites.length > 0 && (
          <section className="mb-8 rounded-lg border border-brand/40 bg-brand/5 p-4">
            <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-brand">
              Live session invites
            </h2>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.inviteId} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-mono text-brand">@{invite.hostName}</span> invited you to a session on{" "}
                    <span className="font-medium">{invite.promptTitle}</span>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void acceptSession(invite)}
                      className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
                    >
                      Join
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void declineSession(invite)}>
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {myActivity.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Recently edited by you
            </h2>
            <div className="flex flex-wrap gap-2">
              {myActivity.map((a) => (
                <Link
                  key={a.id}
                  to={`/projects/${a.project_id}`}
                  className="rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-[transform,opacity] hover:-translate-y-0.5 hover:border-border"
                >
                  <span className="text-xs text-foreground/90">{a.verb}</span>
                  {a.target && <span className="text-xs text-muted-foreground"> · {a.target}</span>}
                  <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground">
                    {nameById.get(a.project_id) ?? "project"} · {formatRelativeTime(a.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Projects</h1>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
          >
            <Plus className="mr-1.5 size-4" />
            New project
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-border/50 bg-card/40" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
            <p className="font-display text-xl">No projects yet.</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Create your first project to start writing prompts.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-6 bg-brand font-medium text-brand-foreground hover:bg-brand/90"
            >
              <Plus className="mr-1.5 size-4" />
              New project
            </Button>
          </div>
        ) : (
          <ProjectList projects={active} onArchiveToggle={(p) => void setArchived(p.id, !p.archived)} />
        )}

        {archived.length > 0 && (
          <section className="mt-12">
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="font-mono text-xs text-muted-foreground transition-opacity hover:text-foreground"
            >
              {showArchived ? "▾" : "▸"} Archived · {archived.length}
            </button>
            {showArchived && (
              <div className="mt-4">
                <ProjectList
                  projects={archived}
                  onArchiveToggle={(p) => void setArchived(p.id, !p.archived)}
                />
              </div>
            )}
          </section>
        )}
      </motion.main>

      <NewProjectModal open={createOpen} onOpenChange={setCreateOpen} onSubmit={createProject} />
    </div>
  )
}
