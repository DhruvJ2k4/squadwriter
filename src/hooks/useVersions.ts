import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { logActivity } from "@/hooks/useActivity"
import type { Json, Prompt, PromptSection, PromptVersion } from "@/lib/types"

export type VersionWithAuthor = PromptVersion & { authorName: string }

type SaveArgs = { label: string; expectedCounter: number; force?: boolean }
type SaveResult = { error?: string; stale?: boolean; currentCounter?: number; newCounter?: number }
type Result = { error: string | null; id?: string }

/** Pull the section array back out of a stored snapshot ({ sections: [...] }). */
export function readSnapshotSections(snapshot: Json): PromptSection[] {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const sections = (snapshot as { sections?: unknown }).sections
    if (Array.isArray(sections)) return sections as PromptSection[]
  }
  return []
}

export function useVersions(promptId: string | undefined) {
  const { user } = useAuth()
  const [versions, setVersions] = useState<VersionWithAuthor[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!promptId) return
    setLoading(true)
    const { data } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("prompt_id", promptId)
      .order("created_at", { ascending: false })
    const rows = data ?? []
    const authorIds = [...new Set(rows.map((v) => v.saved_by))]
    let names = new Map<string, string>()
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", authorIds)
      names = new Map((profiles ?? []).map((p) => [p.id, p.username]))
    }
    setVersions(rows.map((v) => ({ ...v, authorName: names.get(v.saved_by) ?? "unknown" })))
    setLoading(false)
  }, [promptId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  /** Snapshot all sections into prompt_versions and bump version_counter (one row per Save). */
  const saveVersion = useCallback(
    async ({ label, expectedCounter, force }: SaveArgs): Promise<SaveResult> => {
      if (!user || !promptId) return { error: "Not ready." }
      const { data: current, error } = await supabase
        .from("prompts")
        .select("version_counter, project_id, title")
        .eq("id", promptId)
        .single()
      if (error || !current) return { error: error?.message ?? "Prompt not found." }

      // Optimistic lock: someone else saved since this editor opened.
      if (!force && current.version_counter !== expectedCounter) {
        return { stale: true, currentCounter: current.version_counter }
      }

      const { data: sections } = await supabase
        .from("prompt_sections")
        .select("*")
        .eq("prompt_id", promptId)
        .order("position")
      const snapshot = { sections: sections ?? [] } as unknown as Json

      const { error: insertError } = await supabase
        .from("prompt_versions")
        .insert({ prompt_id: promptId, snapshot, saved_by: user.id, label: label.trim() || null })
      if (insertError) return { error: insertError.message }

      const newCounter = current.version_counter + 1
      await supabase.from("prompts").update({ version_counter: newCounter }).eq("id", promptId)
      await logActivity({
        projectId: current.project_id,
        actorId: user.id,
        verb: "saved a version",
        target: current.title,
      })
      await refetch()
      return { newCounter }
    },
    [user, promptId, refetch],
  )

  /** Overwrite the live sections with a version's snapshot (preserves matched section ids). */
  const restoreVersion = useCallback(
    async (version: PromptVersion, prompt: Prompt): Promise<Result> => {
      if (!user) return { error: "Not signed in." }
      const snapSections = readSnapshotSections(version.snapshot)
      const { data: current } = await supabase
        .from("prompt_sections")
        .select("id")
        .eq("prompt_id", prompt.id)
      const currentIds = new Set((current ?? []).map((s) => s.id))
      const snapIds = new Set(snapSections.map((s) => s.id))

      for (const s of snapSections) {
        const payload = {
          section_type: s.section_type,
          title: s.title,
          content: s.content,
          position: s.position,
          archived: s.archived,
        }
        if (currentIds.has(s.id)) {
          await supabase.from("prompt_sections").update(payload).eq("id", s.id)
        } else {
          await supabase.from("prompt_sections").insert({ id: s.id, prompt_id: prompt.id, ...payload })
        }
      }
      for (const id of currentIds) {
        if (!snapIds.has(id)) await supabase.from("prompt_sections").delete().eq("id", id)
      }

      await logActivity({
        projectId: prompt.project_id,
        actorId: user.id,
        verb: "restored a version",
        target: prompt.title,
      })
      return { error: null }
    },
    [user],
  )

  /** Create a brand-new prompt in the same project from a version's snapshot. */
  const duplicateAsNewPrompt = useCallback(
    async (version: PromptVersion, prompt: Prompt): Promise<Result> => {
      if (!user) return { error: "Not signed in." }
      const snapSections = readSnapshotSections(version.snapshot)
      const { data: created, error } = await supabase
        .from("prompts")
        .insert({
          project_id: prompt.project_id,
          owner_id: user.id,
          title: `${prompt.title} (from version)`,
          prompt_kind: prompt.prompt_kind,
          prompt_type: prompt.prompt_type,
          has_json_tab: prompt.has_json_tab,
        })
        .select()
        .single()
      if (error || !created) return { error: error?.message ?? "Could not create prompt." }

      if (snapSections.length) {
        const clones = snapSections.map((s) => ({
          prompt_id: created.id,
          section_type: s.section_type,
          title: s.title,
          content: s.content,
          position: s.position,
          archived: s.archived,
        }))
        const { error: sectionError } = await supabase.from("prompt_sections").insert(clones)
        if (sectionError) return { error: sectionError.message }
      }

      await logActivity({
        projectId: prompt.project_id,
        actorId: user.id,
        verb: "duplicated a version to a new prompt",
        target: created.title,
      })
      return { error: null, id: created.id }
    },
    [user],
  )

  return { versions, loading, refetch, saveVersion, restoreVersion, duplicateAsNewPrompt }
}
