import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Pencil, Users } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useActivity } from "@/hooks/useActivity"
import { setProjectArchivedRow, updateProjectRow } from "@/hooks/useProjects"
import { supabase } from "@/lib/supabase"
import { NewProjectModal } from "@/components/projects/NewProjectModal"
import { MembersModal, type MemberRow } from "@/components/projects/MembersModal"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/utils"
import type { Project } from "@/lib/types"

export function ProjectPage() {
  const { id } = useParams()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  const { items: activity, refetch: refetchActivity } = useActivity({ projectId: id, enabled: !!id })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data: proj } = await supabase.from("projects").select("*").eq("id", id).maybeSingle()
    setProject(proj ?? null)
    if (proj) {
      const { data: mem } = await supabase
        .from("project_members")
        .select("id, user_id, role")
        .eq("project_id", id)
      const userIds = (mem ?? []).map((m) => m.user_id)
      let profiles: { id: string; username: string; email: string }[] = []
      if (userIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, email")
          .in("id", userIds)
        profiles = data ?? []
      }
      const byId = new Map(profiles.map((p) => [p.id, p]))
      setMembers(
        (mem ?? []).map((m) => ({
          membershipId: m.id,
          userId: m.user_id,
          role: m.role,
          username: byId.get(m.user_id)?.username ?? "unknown",
          email: byId.get(m.user_id)?.email ?? "",
        })),
      )
    } else {
      setMembers([])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const myRole = members.find((m) => m.userId === user?.id)?.role ?? null
  const isOwner = myRole === "owner"
  const nameByActor = new Map(members.map((m) => [m.userId, m.username]))

  async function reloadAll() {
    await Promise.all([load(), refetchActivity()])
  }

  if (loading && !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-mono text-xs text-muted-foreground">Loading project…</span>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="font-display text-2xl">Project not found.</p>
        <p className="font-mono text-xs text-muted-foreground">
          It may have been removed, or you don't have access.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>
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
        {/* Project header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl font-semibold tracking-tight">{project.name}</h1>
              {project.archived && (
                <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  archived
                </Badge>
              )}
            </div>
            {project.client_name && (
              <p className="mt-1 font-mono text-sm text-muted-foreground">{project.client_name}</p>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
                <Users className="mr-1.5 size-3.5" />
                Members
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await setProjectArchivedRow(user!.id, project.id, !project.archived)
                  await reloadAll()
                }}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                {project.archived ? "Unarchive" : "Archive"}
              </Button>
            </div>
          )}
        </div>

        {project.use_case && (
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted-foreground/90">
            {project.use_case}
          </p>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_18rem]">
          {/* Prompts placeholder (Stage 5) */}
          <section>
            <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
              Prompts
            </h2>
            <div className="rounded-lg border border-dashed border-border/70 bg-card/30 px-6 py-16 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                Prompts and the editor arrive in Stage 5.
              </p>
            </div>
          </section>

          {/* Sidebar: members + activity */}
          <aside className="space-y-8">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Members · {members.length}
                </h2>
                {isOwner && (
                  <button
                    onClick={() => setMembersOpen(true)}
                    className="font-mono text-[0.7rem] text-brand hover:underline"
                  >
                    Manage
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.membershipId} className="flex items-center gap-2.5">
                    <Avatar className="size-6">
                      <AvatarFallback className="bg-secondary font-mono text-[0.55rem] uppercase">
                        {m.username.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">@{m.username}</span>
                    <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                Activity
              </h2>
              {activity.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="text-xs leading-relaxed">
                      <span className="text-brand">@{nameByActor.get(a.actor_id) ?? "someone"}</span>{" "}
                      <span className="text-foreground/80">{a.verb}</span>
                      {a.target && <span className="text-muted-foreground"> · {a.target}</span>}
                      <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground">
                        {formatRelativeTime(a.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </motion.main>

      <NewProjectModal
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSubmit={async (input) => {
          const res = await updateProjectRow(user!.id, project.id, {
            name: input.name.trim(),
            client_name: input.client_name.trim() || null,
            use_case: input.use_case.trim() || null,
          })
          if (!res.error) await reloadAll()
          return res
        }}
      />

      {isOwner && (
        <MembersModal
          open={membersOpen}
          onOpenChange={setMembersOpen}
          projectId={project.id}
          projectName={project.name}
          actorId={user!.id}
          members={members}
          onChanged={reloadAll}
        />
      )}
    </div>
  )
}
