import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Profile, Project, Prompt } from "@/lib/types"

type Tab = "users" | "projects" | "prompts"

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("users")
  const [users, setUsers] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      const [u, p, m] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("prompts").select("*").order("created_at", { ascending: false }),
      ])
      if (!active) return
      setUsers(u.data ?? [])
      setProjects(p.data ?? [])
      setPrompts(m.data ?? [])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const nameById = new Map(users.map((u) => [u.id, u.username]))
  const projectById = new Map(projects.map((p) => [p.id, p.name]))

  // §3.5 — admins raise a project's report limit (guarded by is_admin() in the RPC).
  async function updateMaxReports(projectId: string, next: number) {
    if (next < 1) return
    const { error } = await supabase.rpc("admin_set_max_reports", { p_project: projectId, p_max: next })
    if (!error) {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, max_reports: next } : p)))
    }
  }

  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "users", label: "Users", count: users.length },
    { value: "projects", label: "Projects", count: projects.length },
    { value: "prompts", label: "Prompts", count: prompts.length },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold">Admin console</span>
          <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-5 flex items-center gap-1 border-b border-border/60">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "relative px-3 py-2 font-mono text-xs",
                tab === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} · {t.count}
              {tab === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-card/40" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full font-mono text-xs">
              {tab === "users" && (
                <>
                  <Head cols={["Username", "Email", "Role", "Joined"]} />
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-border/40">
                        <Cell>@{u.username}</Cell>
                        <Cell className="text-muted-foreground">{u.email}</Cell>
                        <Cell>{u.is_admin ? <span className="text-brand">admin</span> : "member"}</Cell>
                        <Cell className="text-muted-foreground">{formatRelativeTime(u.created_at)}</Cell>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === "projects" && (
                <>
                  <Head cols={["Project", "Client", "Owner", "State", "Reports", "Created"]} />
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <Cell>
                          <Link to={`/projects/${p.id}`} className="hover:text-brand">
                            {p.name}
                          </Link>
                        </Cell>
                        <Cell className="text-muted-foreground">{p.client_name || "—"}</Cell>
                        <Cell className="text-muted-foreground">@{nameById.get(p.owner_id) ?? "?"}</Cell>
                        <Cell className="text-muted-foreground">{p.archived ? "archived" : "active"}</Cell>
                        <Cell>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => void updateMaxReports(p.id, (p.max_reports ?? 1) - 1)}
                              disabled={(p.max_reports ?? 1) <= 1}
                              aria-label="Decrease report limit"
                              className="flex size-5 items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-4 text-center tabular-nums">{p.max_reports ?? 1}</span>
                            <button
                              onClick={() => void updateMaxReports(p.id, (p.max_reports ?? 1) + 1)}
                              aria-label="Increase report limit"
                              className="flex size-5 items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-foreground"
                            >
                              +
                            </button>
                          </div>
                        </Cell>
                        <Cell className="text-muted-foreground">{formatRelativeTime(p.created_at)}</Cell>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === "prompts" && (
                <>
                  <Head cols={["Prompt", "Type", "Project", "Owner", "State"]} />
                  <tbody>
                    {prompts.map((p) => (
                      <tr key={p.id} className="border-t border-border/40">
                        <Cell>
                          <Link to={`/prompts/${p.id}`} className="hover:text-brand">
                            {p.title}
                          </Link>
                        </Cell>
                        <Cell className="text-muted-foreground">{p.prompt_type}</Cell>
                        <Cell className="text-muted-foreground">{projectById.get(p.project_id) ?? "?"}</Cell>
                        <Cell className="text-muted-foreground">@{nameById.get(p.owner_id) ?? "?"}</Cell>
                        <Cell className="text-muted-foreground">{p.archived ? "archived" : "active"}</Cell>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-card/40 text-left">
        {cols.map((c) => (
          <th key={c} className="px-3 py-2 font-medium uppercase tracking-wider text-muted-foreground">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>
}
