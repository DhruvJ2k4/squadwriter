import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Eye } from "lucide-react"
import type { Extension } from "@codemirror/state"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useComments, type CommentWithAuthor } from "@/hooks/useComments"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  DEFAULT_THEME_NAME,
  ThemeSelector,
  getThemeExtension,
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

function prettyJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

// ---------------------------------------------------------------------------

interface SectionPaneProps {
  section: PromptSection
  value: string
  onChange: (value: string) => void
  editable: boolean
  themeExtension: Extension
  extraExtensions: Extension[]
  preview: boolean
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
  extraExtensions,
  preview,
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

  const anchoredText = selection ? value.slice(selection.from, selection.to) : ""

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
    setMode(null)
    setBody("")
  }

  return (
    <div>
      {canComment && selection && (
        <div className="mb-3 rounded-md border border-brand/40 bg-brand/5 p-2.5">
          {mode === null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
                “{anchoredText.slice(0, 40)}
                {anchoredText.length > 40 ? "…" : ""}”
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode(null)
                    setBody("")
                    setError(null)
                  }}
                >
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

      <div className={cn("grid gap-3", preview ? "lg:grid-cols-2" : "grid-cols-1")}>
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
          className="overflow-hidden rounded-md border border-border/60"
        />
        {preview && <MarkdownPreview source={value} />}
      </div>
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
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

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
        extraExtensions={canEdit ? editExtras : readonlyExtras}
        preview={preview}
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
