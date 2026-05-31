import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useProjects } from "@/hooks/useProjects"
import { useActivity } from "@/hooks/useActivity"
import { ProjectList } from "@/components/projects/ProjectList"
import { NewProjectModal } from "@/components/projects/NewProjectModal"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/utils"

export function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const { projects, loading, createProject, setArchived } = useProjects()
  const { items: myActivity } = useActivity({ actorId: user?.id, enabled: !!user, limit: 6 })
  const [createOpen, setCreateOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

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
        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
          <span>@{profile?.username}</span>
          <Button variant="ghost" size="sm" onClick={() => void signOut()} className="font-mono text-xs">
            Sign out
          </Button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto max-w-5xl px-6 py-10"
      >
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
