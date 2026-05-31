import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Eye } from "lucide-react"
import type { Extension } from "@codemirror/state"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useComments, type CommentWithAuthor } from "@/hooks/useComments"
import { addJsonSection, removeJsonSection } from "@/hooks/usePrompt"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  DEFAULT_THEME_NAME,
  ThemeSelector,
  getPalette,
  getThemeExtension,
  type Palette,
} from "@/components/editor/ThemeSelector"
import { variableHighlighter } from "@/components/editor/VariableHighlighter"
import { slashCommands } from "@/components/editor/SlashCommands"
import { CodeMirrorEditor, type Selection } from "@/components/editor/CodeMirrorEditor"
import { MarkdownPreview } from "@/components/editor/MarkdownPreview"
import { JsonTab } from "@/components/editor/JsonTab"
import { StageDropdown } from "@/components/editor/StageDropdown"
import { TabView } from "@/components/editor/TabView"
import { ScrollView } from "@/components/editor/ScrollView"
import { TokenCounter } from "@/components/editor/TokenCounter"
import { CommentSidebar } from "@/components/comments/CommentSidebar"
import type { AnchorReport, AnchoredComment } from "@/components/comments/CommentLayer"
import type { CommentType, Prompt, PromptSection } from "@/lib/types"

type SaveState = "idle" | "saving" | "saved" | "error"
type ViewMode = "tabs" | "scroll"
type ComposeMode = "note" | "suggestion"

const EMPTY_COMMENTS: AnchoredComment[] = []
const COMPOSER_WIDTH = 288 // matches w-72, used to clamp the inline composer within the pane

function prettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

/** True on lg+ screens — the editor/preview split is only draggable there; mobile stacks. */
function useIsWide(query = "(min-width: 1024px)"): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : true,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setWide(mq.matches)
    mq.addEventListener("change", onChange)
    setWide(mq.matches)
    return () => mq.removeEventListener("change", onChange)
  }, [query])
  return wide
}

// ---------------------------------------------------------------------------

interface SectionPaneProps {
  section: PromptSection
  value: string
  onChange: (value: string) => void
  editable: boolean
  themeExtension: Extension
  palette: Palette
  extraExtensions: Extension[]
  preview: boolean
  splitPct: number
  onSplitChange: (pct: number) => void
  isWide: boolean
  comments: AnchoredComment[]
  canComment: boolean
  epoch: number
  onCreateComment: (
    sectionId: string,
    from: number,
    to: number,
    anchoredText: string,
    body: string,
    type: CommentType,
  ) => Promise<{ error: string | null }>
  onCommentReport: (reports: AnchorReport[], deletedIds: string[]) => void
  onCommentSelect: (id: string) => void
}

function SectionPane({
  section,
  value,
  onChange,
  editable,
  themeExtension,
  palette,
  extraExtensions,
  preview,
  splitPct,
  onSplitChange,
  isWide,
  comments,
  canComment,
  epoch,
  onCreateComment,
  onCommentReport,
  onCommentSelect,
}: SectionPaneProps) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [mode, setMode] = useState<ComposeMode | null>(null)
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const anchoredText = selection ? value.slice(selection.from, selection.to) : ""
  const horizontal = preview && isWide

  function dismiss() {
    setSelection(null)
    setMode(null)
    setBody("")
    setError(null)
  }

  async function submit() {
    if (!selection || !body.trim() || !mode) return
    setBusy(true)
    setError(null)
    const res = await onCreateComment(section.id, selection.from, selection.to, anchoredText, body.trim(), mode)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    dismiss() // close the inline composer once the comment is posted
  }

  // §2.1 — drag the divider to resize the editor vs. preview width (session-only state).
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const container = rowRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      onSplitChange(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  // §2.5 — anchor the composer near the selection, clamped inside the pane.
  const paneWidth = rowRef.current?.clientWidth ?? 0
  const composerLeft = selection?.coords
    ? Math.max(0, Math.min(selection.coords.left, Math.max(0, paneWidth - COMPOSER_WIDTH - 8)))
    : 0
  const composerTop = selection?.coords ? selection.coords.bottom + 8 : 8

  return (
    <div ref={rowRef} className={cn("relative flex min-w-0 gap-3", horizontal ? "flex-row" : "flex-col")}>
      <div className="min-w-0" style={horizontal ? { width: `${splitPct}%` } : undefined}>
        <CodeMirrorEditor
          key={epoch}
          value={value}
          onChange={onChange}
          editable={editable}
          language="markdown"
          themeExtension={themeExtension}
          extraExtensions={extraExtensions}
          comments={comments}
          onCommentReport={onCommentReport}
          onCommentSelect={onCommentSelect}
          onSelectionChange={setSelection}
          className="h-full overflow-hidden rounded-md border border-border/60"
        />
      </div>

      {horizontal && (
        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startResize}
          title="Drag to resize"
          className="group relative w-2 shrink-0 cursor-col-resize"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70 transition-colors group-hover:bg-brand" />
        </div>
      )}

      {preview && (
        <div className={cn("min-w-0", horizontal && "flex-1")}>
          <MarkdownPreview source={value} palette={palette} className="h-full" />
        </div>
      )}

      {canComment && selection && (
        <div
          className="absolute z-20 w-72 rounded-md border border-brand/40 bg-popover p-2.5 shadow-md"
          style={{ top: composerTop, left: composerLeft }}
        >
          {mode === null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
                “{anchoredText.slice(0, 32)}
                {anchoredText.length > 32 ? "…" : ""}”
              </span>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setMode("note")
                    setBody("")
                    setError(null)
                  }}
                  className="h-7 bg-brand font-medium text-brand-foreground hover:bg-brand/90"
                >
                  Add note
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMode("suggestion")
                    setBody(anchoredText)
                    setError(null)
                  }}
                  className="h-7"
                >
                  Suggest edit
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {mode === "note" ? "Note" : "Proposed replacement"}
              </p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={mode === "note" ? "Leave a note on the selection…" : "Proposed replacement text…"}
                rows={mode === "suggestion" ? 3 : 2}
                autoFocus
                className="text-sm focus-visible:border-brand focus-visible:ring-brand/25"
              />
              {error && <p className="font-mono text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={busy || !body.trim()}
                  onClick={() => void submit()}
                  className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
                >
                  {busy ? "Saving…" : mode === "note" ? "Add note" : "Suggest edit"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface Props {
  prompt: Prompt
  initialSections: PromptSection[]
  canEdit: boolean
  canComment: boolean
}

export function PromptEditor({ prompt, initialSections, canEdit, canComment }: Props) {
  const { user } = useAuth()
  const {
    comments,
    repliesByComment,
    createComment,
    setStatus,
    remove,
    applySuggestion,
    addReply,
    reportAnchors,
  } = useComments(prompt.id)

  const [localSections, setLocalSections] = useState<PromptSection[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [epochs, setEpochs] = useState<Record<string, number>>({})
  const [activeId, setActiveId] = useState<string>("")
  const [viewMode, setViewMode] = useState<ViewMode>("tabs")
  const [themeName, setThemeName] = useState<string>(DEFAULT_THEME_NAME)
  const [preview, setPreview] = useState(false)
  const [splitPct, setSplitPct] = useState(50)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const isWide = useIsWide()

  const seededId = useRef<string | null>(null)
  const timersRef = useRef<Record<string, number>>({})
  const localSectionsRef = useRef<PromptSection[]>([])
  localSectionsRef.current = localSections
  const addStageRef = useRef<(() => void) | null>(null)

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
  const palette = useMemo(() => getPalette(themeName), [themeName])
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

  const renameStage = useCallback(async (stage: PromptSection, title: string) => {
    await supabase.from("prompt_sections").update({ title }).eq("id", stage.id)
    setLocalSections((prev) => prev.map((s) => (s.id === stage.id ? { ...s, title } : s)))
  }, [])

  // §2.3 — optional RAG JSON section toggle for Monolithic / Prompt-Chaining prompts.
  const addJsonTab = useCallback(async () => {
    const res = await addJsonSection(prompt.id)
    if (res.error || !res.section) return
    const created = res.section
    setLocalSections((prev) => [...prev, created])
    setDrafts((d) => ({ ...d, [created.id]: prettyJson(created.content) }))
    setActiveId(created.id)
  }, [prompt.id])

  const removeJsonTab = useCallback(async () => {
    const json = localSectionsRef.current.find((s) => s.section_type === "rag_json")
    if (!json) return
    const content = (drafts[json.id] ?? "").trim()
    if (content && content !== "{}") {
      if (!window.confirm("Remove the RAG JSON section? Its content will be permanently deleted.")) return
    }
    const res = await removeJsonSection(prompt.id)
    if (res.error) return
    setLocalSections((prev) => prev.filter((s) => s.section_type !== "rag_json"))
    setDrafts((d) => {
      const next = { ...d }
      delete next[json.id]
      return next
    })
    setActiveId((cur) =>
      cur === json.id ? (localSectionsRef.current.find((s) => s.section_type === "main")?.id ?? cur) : cur,
    )
  }, [prompt.id, drafts])

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
  const hasJson = useMemo(() => localSections.some((s) => s.section_type === "rag_json"), [localSections])
  const commentsBySection = useMemo(() => {
    const map = new Map<string, AnchoredComment[]>()
    for (const c of comments) {
      const list = map.get(c.section_id) ?? []
      list.push({ id: c.id, from: c.anchor_start, to: c.anchor_end, anchoredText: c.anchored_text })
      map.set(c.section_id, list)
    }
    return map
  }, [comments])

  const isChaining = prompt.prompt_type === "prompt_chaining"
  const canToggleJson =
    canEdit && (prompt.prompt_type === "monolithic" || prompt.prompt_type === "prompt_chaining")
  const activeSection = visibleSections.find((s) => s.id === activeId) ?? visibleSections[0]
  const counterText =
    viewMode === "tabs"
      ? (drafts[activeSection?.id ?? ""] ?? "")
      : visibleSections.map((s) => drafts[s.id] ?? "").join("\n\n")

  const handleCreateComment = useCallback(
    (sectionId: string, from: number, to: number, anchoredText: string, body: string, type: CommentType) =>
      createComment({ sectionId, anchorStart: from, anchorEnd: to, anchoredText, body, type }),
    [createComment],
  )

  async function handleApply(comment: CommentWithAuthor) {
    const oldContent = drafts[comment.section_id] ?? ""
    const res = await applySuggestion(comment, oldContent)
    if (res.error || res.newContent === undefined) return
    const newContent = res.newContent
    setDrafts((d) => ({ ...d, [comment.section_id]: newContent }))
    setEpochs((e) => ({ ...e, [comment.section_id]: (e[comment.section_id] ?? 0) + 1 }))
    setActiveCommentId(null)
  }

  function handleFocusComment(sectionId: string, commentId: string) {
    setActiveId(sectionId)
    setActiveCommentId(commentId)
    if (viewMode === "scroll") {
      window.setTimeout(() => {
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    }
  }

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
      <SectionPane
        section={section}
        value={drafts[section.id] ?? ""}
        onChange={(v) => updateContent(section.id, v)}
        editable={canEdit}
        themeExtension={themeExtension}
        palette={palette}
        extraExtensions={canEdit ? editExtras : readonlyExtras}
        preview={preview}
        splitPct={splitPct}
        onSplitChange={setSplitPct}
        isWide={isWide}
        comments={commentsBySection.get(section.id) ?? EMPTY_COMMENTS}
        canComment={canComment}
        epoch={epochs[section.id] ?? 0}
        onCreateComment={handleCreateComment}
        onCommentReport={reportAnchors}
        onCommentSelect={setActiveCommentId}
      />
    )
  }

  if (!activeSection) {
    return <p className="font-mono text-xs text-muted-foreground">Loading editor…</p>
  }

  const showSidebar = canComment || comments.length > 0

  return (
    <div>
      {!canEdit && (
        <p className="mb-3 font-mono text-xs text-muted-foreground">
          Read-only — you're not the owner of this prompt.
          {canComment ? " Select text to add a note or suggestion." : ""}
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
              onRename={(s, title) => void renameStage(s, title)}
              onArchiveToggle={(s) => void archiveStage(s)}
              onDelete={(s) => void deleteStage(s)}
            />
          )}
          {canToggleJson && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void (hasJson ? removeJsonTab() : addJsonTab())}
              className="h-8 font-mono text-xs"
            >
              {hasJson ? "Remove RAG JSON" : "Add RAG JSON"}
            </Button>
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

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
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

        {showSidebar && (
          <aside className="w-full shrink-0 lg:w-72">
            <div className="lg:sticky lg:top-4">
              <CommentSidebar
                comments={comments}
                repliesByComment={repliesByComment}
                activeId={activeCommentId}
                isOwner={canEdit}
                canReply={canComment}
                currentUserId={user?.id}
                onFocus={(c) => handleFocusComment(c.section_id, c.id)}
                onResolve={(id) => void setStatus(id, "resolved")}
                onIgnore={(id) => void setStatus(id, "ignored")}
                onApply={(c) => void handleApply(c)}
                onDelete={(id) => void remove(id)}
                onReply={addReply}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
