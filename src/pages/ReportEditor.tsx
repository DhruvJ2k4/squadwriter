import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, Copy, ExternalLink, Plus, Save, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useReport } from "@/hooks/useReport"
import { supabase } from "@/lib/supabase"
import { sanitizeReportHtml } from "@/lib/sanitize"
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor"
import { DEFAULT_THEME_NAME, getThemeExtension } from "@/components/editor/ThemeSelector"
import { ReportFrame } from "@/components/reports/ReportFrame"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { MemberRole } from "@/lib/types"

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

export function ReportEditor() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reports, atLimit, maxReports, loading, createReport, saveDraft, publish, unpublish, deleteReport } =
    useReport(projectId)

  const [role, setRole] = useState<MemberRole | null>(null)
  const [roleReady, setRoleReady] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [source, setSource] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [splitPct, setSplitPct] = useState(50)

  const rowRef = useRef<HTMLDivElement>(null)
  const isWide = useIsWide()
  const themeExtension = useMemo(() => getThemeExtension(DEFAULT_THEME_NAME), [])

  useEffect(() => {
    if (!projectId || !user) return
    let active = true
    void supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProjectName(data?.name ?? "")
      })
    void supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setRole((data?.role as MemberRole) ?? null)
        setRoleReady(true)
      })
    return () => {
      active = false
    }
  }, [projectId, user])

  const canEdit = role === "owner" || role === "editor"
  const selected = reports.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && reports.length) setSelectedId(reports[0].id)
  }, [selectedId, reports])

  // Seed the editor when switching reports (keyed on id so saves don't clobber local edits).
  useEffect(() => {
    if (selected) {
      setTitle(selected.title)
      setSource(selected.html_source)
      setError(null)
      setCopied(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // Sandboxed preview shows the SANITIZED draft (exactly what the public page renders), debounced.
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewHtml(sanitizeReportHtml(source)), 250)
    return () => window.clearTimeout(t)
  }, [source])

  const dirty = !!selected && (title !== selected.title || source !== selected.html_source)
  const publicUrl = selected?.public_token ? `${window.location.origin}/r/${selected.public_token}` : null
  const horizontal = isWide

  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const container = rowRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPct(Math.min(80, Math.max(20, pct)))
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  async function handleCreate() {
    setBusy(true)
    setError(null)
    const res = await createReport(newTitle)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setNewTitle("")
    if (res.id) setSelectedId(res.id)
  }

  async function handleSave() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await saveDraft(selected.id, { title, html_source: source })
    setBusy(false)
    if (res.error) setError(res.error)
  }

  async function handlePublish() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await publish(selected.id, source, title)
    setBusy(false)
    if (res.error) setError(res.error)
  }

  async function handleUnpublish() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await unpublish(selected.id)
    setBusy(false)
    if (res.error) setError(res.error)
  }

  async function handleDelete() {
    if (!selected) return
    if (!window.confirm("Delete this report? This removes it and its public link permanently.")) return
    setBusy(true)
    setError(null)
    const res = await deleteReport(selected.id)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setSelectedId(null)
  }

  async function copyLink() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const header = (
    <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
      <Link
        to={`/projects/${projectId}`}
        className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {projectName || "Back to project"}
      </Link>
      <span className="font-display text-sm font-semibold">Client report</span>
    </header>
  )

  if (loading || !roleReady) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {header}
        <p className="px-6 py-10 font-mono text-xs text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
          <p className="font-display text-2xl">Reports are editable by the project owner or editors.</p>
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
            Back to project
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {header}

      <div className="flex items-center gap-2 border-b border-border/60 px-6 py-2">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-xs",
              r.id === selected?.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.title || "Untitled"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider",
                r.status === "published" ? "bg-brand/20 text-brand" : "bg-card text-muted-foreground",
              )}
            >
              {r.status}
            </span>
          </button>
        ))}
        {!atLimit ? (
          <div className="ml-auto flex items-center gap-1.5">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate()
              }}
              placeholder="New report title…"
              className="h-7 w-44 text-xs focus-visible:border-brand focus-visible:ring-brand/25"
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() => void handleCreate()}
              className="h-7 bg-brand font-medium text-brand-foreground hover:bg-brand/90"
            >
              <Plus className="mr-1 size-3.5" />
              New
            </Button>
          </div>
        ) : (
          reports.length > 0 && (
            <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
              Limit reached ({reports.length}/{maxReports}) — an admin can raise it.
            </span>
          )
        )}
      </div>

      {!selected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-display text-xl">No report yet.</p>
          <p className="max-w-md font-mono text-xs text-muted-foreground">
            {atLimit
              ? `This project is at its report limit (${maxReports}). An admin can raise it.`
              : "Give it a title above and click New to create this project's report."}
          </p>
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Report title"
              className="h-9 max-w-sm font-display text-base focus-visible:border-brand focus-visible:ring-brand/25"
            />
            <div className="flex flex-wrap items-center gap-2">
              {error && <span className="font-mono text-xs text-destructive">{error}</span>}
              <Button variant="outline" size="sm" disabled={busy || !dirty} onClick={() => void handleSave()}>
                <Save className="mr-1.5 size-3.5" />
                {dirty ? "Save draft" : "Saved"}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void handlePublish()}
                className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
              >
                {selected.status === "published" ? "Republish" : "Publish"}
              </Button>
              {selected.status === "published" && publicUrl && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                    {copied ? <Check className="mr-1.5 size-3.5 text-brand" /> : <Copy className="mr-1.5 size-3.5" />}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                    Open
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleUnpublish()}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    Unpublish
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="size-8 text-muted-foreground hover:text-destructive"
                title="Delete report"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {selected.status === "published" && dirty && (
            <p className="mb-2 font-mono text-[0.7rem] text-amber-400">
              You have unpublished changes. Clients see the last published version until you Republish.
            </p>
          )}

          <div ref={rowRef} className={cn("flex min-h-0 flex-1 gap-3", horizontal ? "flex-row" : "flex-col")}>
            <div className="flex min-h-0 flex-col" style={horizontal ? { width: `${splitPct}%` } : undefined}>
              <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                HTML source
              </p>
              <CodeMirrorEditor
                value={source}
                onChange={setSource}
                editable
                language="html"
                themeExtension={themeExtension}
                className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60"
              />
            </div>

            {horizontal && (
              <div
                role="separator"
                aria-orientation="vertical"
                onPointerDown={startResize}
                title="Drag to resize"
                className="group relative w-2 shrink-0 cursor-col-resize self-stretch"
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70 transition-colors group-hover:bg-brand" />
              </div>
            )}

            <div className={cn("flex min-h-0 flex-col", horizontal ? "flex-1" : "min-h-[20rem]")}>
              <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                Preview · sandboxed (no scripts)
              </p>
              <ReportFrame html={previewHtml} title={title} className="min-h-0 flex-1 rounded-md border border-border/60" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
