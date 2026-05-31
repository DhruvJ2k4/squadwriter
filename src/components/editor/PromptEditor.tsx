import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DEFAULT_THEME_NAME,
  ThemeSelector,
  getThemeExtension,
} from "@/components/editor/ThemeSelector"
import { variableHighlighter } from "@/components/editor/VariableHighlighter"
import { slashCommands } from "@/components/editor/SlashCommands"
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor"
import { MarkdownPreview } from "@/components/editor/MarkdownPreview"
import { JsonTab } from "@/components/editor/JsonTab"
import { StageDropdown } from "@/components/editor/StageDropdown"
import { TabView } from "@/components/editor/TabView"
import { ScrollView } from "@/components/editor/ScrollView"
import { TokenCounter } from "@/components/editor/TokenCounter"
import type { Prompt, PromptSection } from "@/lib/types"

type SaveState = "idle" | "saving" | "saved" | "error"
type ViewMode = "tabs" | "scroll"

function prettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

interface Props {
  prompt: Prompt
  initialSections: PromptSection[]
  canEdit: boolean
}

export function PromptEditor({ prompt, initialSections, canEdit }: Props) {
  const [localSections, setLocalSections] = useState<PromptSection[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string>("")
  const [viewMode, setViewMode] = useState<ViewMode>("tabs")
  const [themeName, setThemeName] = useState<string>(DEFAULT_THEME_NAME)
  const [preview, setPreview] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("idle")

  const seededId = useRef<string | null>(null)
  const timersRef = useRef<Record<string, number>>({})
  const localSectionsRef = useRef<PromptSection[]>([])
  localSectionsRef.current = localSections
  const addStageRef = useRef<(() => void) | null>(null)

  // Seed local state once the server sections arrive for this prompt.
  useEffect(() => {
    if (prompt.id !== seededId.current && initialSections.length > 0) {
      seededId.current = prompt.id
      const sorted = [...initialSections].sort((a, b) => a.position - b.position)
      setLocalSections(sorted)
      const next: Record<string, string> = {}
      for (const s of sorted) {
        next[s.id] = s.section_type === "rag_json" ? prettyJson(s.content) : s.content
      }
      setDrafts(next)
      const firstVisible = sorted.find((s) => !s.archived) ?? sorted[0]
      setActiveId(firstVisible?.id ?? "")
    }
  }, [prompt.id, initialSections])

  const themeExtension = useMemo(() => getThemeExtension(themeName), [themeName])
  const varExtension = useMemo(() => variableHighlighter(), [])

  const updateContent = useCallback(
    (id: string, content: string) => {
      setDrafts((d) => ({ ...d, [id]: content }))
      if (!canEdit) return
      setSaveState("saving")
      const timers = timersRef.current
      if (timers[id]) window.clearTimeout(timers[id])
      timers[id] = window.setTimeout(() => {
        void supabase
          .from("prompt_sections")
          .update({ content })
          .eq("id", id)
          .then(({ error }) => setSaveState(error ? "error" : "saved"))
      }, 700)
    },
    [canEdit],
  )

  const addStage = useCallback(async () => {
    const sections = localSectionsRef.current
    const stageCount = sections.filter((s) => s.section_type === "stage").length
    const position = sections.reduce((max, s) => Math.max(max, s.position), 0) + 1
    const { data, error } = await supabase
      .from("prompt_sections")
      .insert({
        prompt_id: prompt.id,
        section_type: "stage",
        title: `Stage ${stageCount + 1}`,
        content: "",
        position,
      })
      .select()
      .single()
    if (error || !data) return
    setLocalSections((prev) => [...prev, data])
    setDrafts((d) => ({ ...d, [data.id]: "" }))
    setActiveId(data.id)
  }, [prompt.id])
  addStageRef.current = addStage

  const archiveStage = useCallback(async (stage: PromptSection) => {
    const next = !stage.archived
    await supabase.from("prompt_sections").update({ archived: next }).eq("id", stage.id)
    setLocalSections((prev) => prev.map((s) => (s.id === stage.id ? { ...s, archived: next } : s)))
    if (next) {
      setActiveId((cur) =>
        cur === stage.id
          ? (localSectionsRef.current.find((s) => s.section_type === "main")?.id ?? cur)
          : cur,
      )
    }
  }, [])

  const deleteStage = useCallback(async (stage: PromptSection) => {
    if (!window.confirm(`Delete "${stage.title || "this stage"}"? This removes it and its content.`)) {
      return
    }
    await supabase.from("prompt_sections").delete().eq("id", stage.id)
    setLocalSections((prev) => prev.filter((s) => s.id !== stage.id))
    setDrafts((d) => {
      const next = { ...d }
      delete next[stage.id]
      return next
    })
    setActiveId((cur) =>
      cur === stage.id
        ? (localSectionsRef.current.find((s) => s.section_type === "main")?.id ?? cur)
        : cur,
    )
  }, [])

  const slashExtension = useMemo(
    () =>
      slashCommands([
        {
          label: "/section",
          detail: "Insert a section heading",
          apply: (view, from, to) => {
            const insert = "## Section\n\n"
            view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } })
          },
        },
        {
          label: "/stage",
          detail: "Add a new stage section",
          apply: (view, from, to) => {
            view.dispatch({ changes: { from, to, insert: "" } })
            addStageRef.current?.()
          },
        },
      ]),
    [],
  )

  const editExtras = useMemo(() => [varExtension, slashExtension], [varExtension, slashExtension])
  const readonlyExtras = useMemo(() => [varExtension], [varExtension])

  const visibleSections = useMemo(
    () => localSections.filter((s) => !s.archived).sort((a, b) => a.position - b.position),
    [localSections],
  )
  const stageSections = useMemo(
    () => localSections.filter((s) => s.section_type === "stage").sort((a, b) => a.position - b.position),
    [localSections],
  )
  const isChaining = prompt.prompt_type === "prompt_chaining"
  const activeSection = visibleSections.find((s) => s.id === activeId) ?? visibleSections[0]
  const counterText =
    viewMode === "tabs"
      ? (drafts[activeSection?.id ?? ""] ?? "")
      : visibleSections.map((s) => drafts[s.id] ?? "").join("\n\n")

  const renderPane = (section: PromptSection) => {
    if (section.section_type === "rag_json") {
      return (
        <JsonTab
          value={drafts[section.id] ?? ""}
          onChange={(v) => updateContent(section.id, v)}
          editable={canEdit}
          themeExtension={themeExtension}
        />
      )
    }
    return (
      <div className={cn("grid gap-3", preview ? "lg:grid-cols-2" : "grid-cols-1")}>
        <CodeMirrorEditor
          value={drafts[section.id] ?? ""}
          onChange={(v) => updateContent(section.id, v)}
          editable={canEdit}
          language="markdown"
          themeExtension={themeExtension}
          extraExtensions={canEdit ? editExtras : readonlyExtras}
          className="overflow-hidden rounded-md border border-border/60"
        />
        {preview && <MarkdownPreview source={drafts[section.id] ?? ""} />}
      </div>
    )
  }

  if (!activeSection) {
    return <p className="font-mono text-xs text-muted-foreground">Loading editor…</p>
  }

  return (
    <div>
      {!canEdit && (
        <p className="mb-3 font-mono text-xs text-muted-foreground">
          Read-only — you're not the owner of this prompt.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            {(["tabs", "scroll"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-xs capitalize transition-opacity",
                  viewMode === mode ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          {isChaining && canEdit && (
            <StageDropdown
              stages={stageSections}
              onAdd={() => void addStage()}
              onArchiveToggle={(s) => void archiveStage(s)}
              onDelete={(s) => void deleteStage(s)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <TokenCounter text={counterText} />
          <Button
            variant={preview ? "default" : "outline"}
            size="sm"
            onClick={() => setPreview((p) => !p)}
            className={cn("h-8 font-mono text-xs", preview && "bg-brand text-brand-foreground hover:bg-brand/90")}
          >
            <Eye className="mr-1.5 size-3.5" />
            Preview
          </Button>
          <ThemeSelector value={themeName} onChange={setThemeName} />
          {canEdit && (
            <span className="w-16 font-mono text-[0.7rem] text-muted-foreground tabular-nums">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : ""}
            </span>
          )}
        </div>
      </div>

      {viewMode === "tabs" ? (
        <TabView
          sections={visibleSections}
          activeId={activeSection.id}
          onSelect={setActiveId}
          renderPane={renderPane}
        />
      ) : (
        <ScrollView sections={visibleSections} renderPane={renderPane} />
      )}
    </div>
  )
}
