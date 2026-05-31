import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { logActivity } from "@/hooks/useActivity"
import type { Prompt, PromptKind, PromptSection, PromptType, SectionType } from "@/lib/types"

export type NewPromptInput = {
  title: string
  kind: PromptKind
  type: PromptType
  /** Monolithic/Prompt-Chaining only: opt into a single RAG JSON section (§2.3). */
  hasJsonTab?: boolean
}
type MutationResult = { error: string | null; id?: string }

type SectionTemplate = {
  section_type: SectionType
  title: string
  content: string
  position: number
}

/**
 * Section composition (§2.3): Monolithic=main · Chaining=main+stage · Entity=main.
 * Monolithic & Chaining optionally append ONE rag_json section. The legacy `rag_enabled`
 * type is no longer creatable from the UI but is still handled for any unmigrated rows.
 */
function sectionTemplates(type: PromptType, hasJsonTab: boolean): SectionTemplate[] {
  const out: SectionTemplate[] = []
  switch (type) {
    case "monolithic":
      out.push({ section_type: "main", title: "Prompt", content: "", position: 0 })
      break
    case "prompt_chaining":
      out.push({ section_type: "main", title: "Prompt", content: "", position: 0 })
      out.push({ section_type: "stage", title: "Stage 1", content: "", position: 1 })
      break
    case "entity":
      out.push({ section_type: "main", title: "Content", content: "", position: 0 })
      break
    case "rag_enabled":
      return [
        { section_type: "main", title: "Prompt", content: "", position: 0 },
        { section_type: "rag_json", title: "RAG JSON", content: "{}", position: 1 },
      ]
  }
  if (hasJsonTab && (type === "monolithic" || type === "prompt_chaining")) {
    out.push({ section_type: "rag_json", title: "RAG JSON", content: "{}", position: out.length })
  }
  return out
}

/** Entity never has a JSON tab; legacy rag_enabled always does; otherwise it is opt-in (§2.3). */
export function deriveHasJsonTab(type: PromptType, hasJsonTab?: boolean): boolean {
  if (type === "entity") return false
  if (type === "rag_enabled") return true
  return !!hasJsonTab
}

export async function createPromptWithSections(
  actorId: string,
  projectId: string,
  input: NewPromptInput,
): Promise<MutationResult> {
  const hasJsonTab = deriveHasJsonTab(input.type, input.hasJsonTab)
  const { data: prompt, error } = await supabase
    .from("prompts")
    .insert({
      project_id: projectId,
      owner_id: actorId,
      title: input.title.trim(),
      prompt_kind: input.kind,
      prompt_type: input.type,
      has_json_tab: hasJsonTab,
    })
    .select()
    .single()
  if (error || !prompt) return { error: error?.message ?? "Could not create prompt." }

  const sections = sectionTemplates(input.type, hasJsonTab).map((s) => ({ ...s, prompt_id: prompt.id }))
  const { error: sectionError } = await supabase.from("prompt_sections").insert(sections)
  if (sectionError) return { error: sectionError.message }

  await logActivity({ projectId, actorId, verb: "created prompt", target: prompt.title })
  return { error: null, id: prompt.id }
}

/** Clone a prompt (and all its sections) into a target project. Powers duplicate + fork. */
async function clonePrompt(
  actorId: string,
  sourceId: string,
  targetProjectId: string,
  verb: string,
  titleFn: (title: string) => string,
): Promise<MutationResult> {
  const { data: source } = await supabase.from("prompts").select("*").eq("id", sourceId).maybeSingle()
  if (!source) return { error: "Source prompt not found." }
  const { data: srcSections } = await supabase
    .from("prompt_sections")
    .select("*")
    .eq("prompt_id", sourceId)
    .order("position")

  const { data: created, error } = await supabase
    .from("prompts")
    .insert({
      project_id: targetProjectId,
      owner_id: actorId,
      title: titleFn(source.title),
      prompt_kind: source.prompt_kind,
      prompt_type: source.prompt_type,
      has_json_tab: source.has_json_tab,
    })
    .select()
    .single()
  if (error || !created) return { error: error?.message ?? "Could not create prompt." }

  if (srcSections && srcSections.length) {
    const clones = srcSections.map((s) => ({
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

  await logActivity({ projectId: targetProjectId, actorId, verb, target: created.title })
  return { error: null, id: created.id }
}

export function duplicatePrompt(actorId: string, sourceId: string, projectId: string) {
  return clonePrompt(actorId, sourceId, projectId, "duplicated prompt", (t) => `${t} (copy)`)
}

export function forkPrompt(actorId: string, sourceId: string, targetProjectId: string) {
  return clonePrompt(actorId, sourceId, targetProjectId, "forked prompt", (t) => t)
}

export async function setPromptArchivedRow(
  actorId: string,
  promptId: string,
  projectId: string,
  archived: boolean,
  title: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("prompts").update({ archived }).eq("id", promptId)
  if (error) return { error: error.message }
  await logActivity({
    projectId,
    actorId,
    verb: archived ? "archived prompt" : "unarchived prompt",
    target: title,
  })
  return { error: null }
}

export async function deletePromptRow(
  actorId: string,
  promptId: string,
  projectId: string,
  title: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("prompts").delete().eq("id", promptId)
  if (error) return { error: error.message }
  await logActivity({ projectId, actorId, verb: "deleted prompt", target: title })
  return { error: null }
}

export async function renamePromptRow(
  actorId: string,
  promptId: string,
  projectId: string,
  title: string,
): Promise<MutationResult> {
  const clean = title.trim()
  const { error } = await supabase.from("prompts").update({ title: clean }).eq("id", promptId)
  if (error) return { error: error.message }
  await logActivity({ projectId, actorId, verb: "renamed prompt", target: clean })
  return { error: null }
}

/** §2.3 toggle ON: add the single RAG JSON section to a monolithic/PC prompt + set the flag. */
export async function addJsonSection(
  promptId: string,
): Promise<{ error: string | null; section?: PromptSection }> {
  const { data: existing } = await supabase
    .from("prompt_sections")
    .select("position")
    .eq("prompt_id", promptId)
  const position = (existing ?? []).reduce((max, s) => Math.max(max, s.position), -1) + 1
  const { data, error } = await supabase
    .from("prompt_sections")
    .insert({ prompt_id: promptId, section_type: "rag_json", title: "RAG JSON", content: "{}", position })
    .select()
    .single()
  if (error || !data) return { error: error?.message ?? "Could not add the JSON section." }
  await supabase.from("prompts").update({ has_json_tab: true }).eq("id", promptId)
  return { error: null, section: data }
}

/** §2.3 toggle OFF: remove the RAG JSON section(s) from a prompt + clear the flag. */
export async function removeJsonSection(promptId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("prompt_sections")
    .delete()
    .eq("prompt_id", promptId)
    .eq("section_type", "rag_json")
  if (error) return { error: error.message }
  await supabase.from("prompts").update({ has_json_tab: false }).eq("id", promptId)
  return { error: null }
}

/** List a project's prompts + create. */
export function usePrompts(projectId: string | undefined) {
  const { user } = useAuth()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const { data } = await supabase
      .from("prompts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
    setPrompts(data ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createPrompt = useCallback(
    async (input: NewPromptInput): Promise<MutationResult> => {
      if (!user || !projectId) return { error: "Not ready." }
      const res = await createPromptWithSections(user.id, projectId, input)
      if (!res.error) await refetch()
      return res
    },
    [user, projectId, refetch],
  )

  return { prompts, loading, refetch, createPrompt }
}

/** A single prompt with its sections (read view; the editor lands in Stage 6). */
export function usePrompt(promptId: string | undefined) {
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [sections, setSections] = useState<PromptSection[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!promptId) return
    setLoading(true)
    const { data: p } = await supabase.from("prompts").select("*").eq("id", promptId).maybeSingle()
    setPrompt(p ?? null)
    if (p) {
      const { data: secs } = await supabase
        .from("prompt_sections")
        .select("*")
        .eq("prompt_id", promptId)
        .order("position")
      setSections(secs ?? [])
    } else {
      setSections([])
    }
    setLoading(false)
  }, [promptId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { prompt, sections, loading, refetch }
}
