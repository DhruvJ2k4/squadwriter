import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { logActivity } from "@/hooks/useActivity"
import type { MemberRole, Project } from "@/lib/types"

export type ProjectWithRole = Project & { myRole: MemberRole | null }

export type ProjectInput = { name: string; client_name: string; use_case: string }
type MutationResult = { error: string | null; id?: string }

/** Create a project and atomically (best-effort) make the creator its owner. */
export async function createProjectRow(actorId: string, input: ProjectInput): Promise<MutationResult> {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: input.name.trim(),
      client_name: input.client_name.trim() || null,
      use_case: input.use_case.trim() || null,
      owner_id: actorId,
    })
    .select()
    .single()
  if (error || !project) return { error: error?.message ?? "Could not create project." }

  const { error: memberError } = await supabase
    .from("project_members")
    .insert({ project_id: project.id, user_id: actorId, role: "owner" })
  if (memberError) return { error: memberError.message }

  await logActivity({ projectId: project.id, actorId, verb: "created project", target: project.name })
  return { error: null, id: project.id }
}

export async function updateProjectRow(
  actorId: string,
  id: string,
  patch: Partial<Pick<Project, "name" | "client_name" | "use_case">>,
): Promise<MutationResult> {
  const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select().single()
  if (error) return { error: error.message }
  await logActivity({ projectId: id, actorId, verb: "edited project", target: data?.name ?? null })
  return { error: null, id }
}

export async function setProjectArchivedRow(
  actorId: string,
  id: string,
  archived: boolean,
): Promise<MutationResult> {
  const { data, error } = await supabase
    .from("projects")
    .update({ archived })
    .eq("id", id)
    .select()
    .single()
  if (error) return { error: error.message }
  await logActivity({
    projectId: id,
    actorId,
    verb: archived ? "archived project" : "unarchived project",
    target: data?.name ?? null,
  })
  return { error: null, id }
}

/** Dashboard hook: lists ONLY the current user's projects (correct even for admins). */
export function useProjects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ProjectWithRole[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: members } = await supabase
      .from("project_members")
      .select("project_id, role")
      .eq("user_id", user.id)
    const roleById = new Map((members ?? []).map((m) => [m.project_id, m.role]))
    const ids = [...roleById.keys()]

    let rows: Project[] = []
    if (ids.length) {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false })
      rows = data ?? []
    }
    setProjects(rows.map((p) => ({ ...p, myRole: roleById.get(p.id) ?? null })))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createProject = useCallback(
    async (input: ProjectInput) => {
      if (!user) return { error: "Not signed in." }
      const res = await createProjectRow(user.id, input)
      if (!res.error) await refetch()
      return res
    },
    [user, refetch],
  )

  const updateProject = useCallback(
    async (id: string, patch: Partial<Pick<Project, "name" | "client_name" | "use_case">>) => {
      if (!user) return { error: "Not signed in." }
      const res = await updateProjectRow(user.id, id, patch)
      if (!res.error) await refetch()
      return res
    },
    [user, refetch],
  )

  const setArchived = useCallback(
    async (id: string, archived: boolean) => {
      if (!user) return { error: "Not signed in." }
      const res = await setProjectArchivedRow(user.id, id, archived)
      if (!res.error) await refetch()
      return res
    },
    [user, refetch],
  )

  return { projects, loading, refetch, createProject, updateProject, setArchived }
}
