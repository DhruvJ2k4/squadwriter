import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Copy, GitFork, History, Save } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  deletePromptRow,
  duplicatePrompt,
  setPromptArchivedRow,
  usePrompt,
} from "@/hooks/usePrompt"
import { useVersions } from "@/hooks/useVersions"
import { ForkModal } from "@/components/prompts/ForkModal"
import { PromptEditor } from "@/components/editor/PromptEditor"
import { VersionHistory } from "@/components/prompts/VersionHistory"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PromptType } from "@/lib/types"

const TYPE_LABEL: Record<PromptType, string> = {
  monolithic: "Monolithic",
  prompt_chaining: "Chaining",
  rag_enabled: "RAG",
  entity: "Entity",
}

export function PromptPage() {
  const { promptId } = useParams()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { prompt, sections, loading, refetch } = usePrompt(promptId)
  const { saveVersion } = useVersions(promptId)

  const [forkOpen, setForkOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  // version_counter captured when the prompt was opened (optimistic-lock baseline).
  const openCounterRef = useRef<number | null>(null)
  useEffect(() => {
    if (prompt && openCounterRef.current === null) openCounterRef.current = prompt.version_counter
  }, [prompt])

  const isOwner = !!prompt && prompt.owner_id === user?.id

  async function handleSave(force: boolean) {
    if (!prompt) return
    setSaveBusy(true)
    setSaveError(null)
    const expected = openCounterRef.current ?? prompt.version_counter
    const res = await saveVersion({ label, expectedCounter: expected, force })
    setSaveBusy(false)
    if (res.stale) {
      setStale(true)
      return
    }
    if (res.error) {
      setSaveError(res.error)
      return
    }
    openCounterRef.current = res.newCounter ?? expected + 1
    setSaveOpen(false)
    setLabel("")
    setStale(false)
    await refetch()
  }

  if (loading && !prompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-mono text-xs text-muted-foreground">Loading prompt…</span>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="font-display text-2xl">Prompt not found.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to dashboard
        </Button>
      </div>
    )
  }

  async function handleDuplicate() {
    if (!user || !prompt) return
    const res = await duplicatePrompt(user.id, prompt.id, prompt.project_id)
    if (res.id) navigate(`/prompts/${res.id}`)
  }

  async function handleArchive() {
    if (!user || !prompt) return
    await setPromptArchivedRow(user.id, prompt.id, prompt.project_id, !prompt.archived, prompt.title)
    await refetch()
  }

  async function confirmDelete() {
    if (!user || !prompt) return
    const projectId = prompt.project_id
    await deletePromptRow(user.id, prompt.id, projectId, prompt.title)
    setDeleteOpen(false)
    navigate(`/projects/${projectId}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <Link
          to={`/projects/${prompt.project_id}`}
          className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to project
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
        className="mx-auto max-w-3xl px-6 py-10"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{prompt.title}</h1>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {TYPE_LABEL[prompt.prompt_type]}
              </Badge>
              {prompt.has_json_tab && (
                <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  JSON tab
                </Badge>
              )}
              {prompt.archived && (
                <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  archived
                </Badge>
              )}
              {!isOwner && (
                <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground/70">
                  read-only
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="mr-1.5 size-3.5" />
              History
            </Button>
            {isOwner && (
              <>
                <Button
                  size="sm"
                  onClick={() => setSaveOpen(true)}
                  className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
                >
                  <Save className="mr-1.5 size-3.5" />
                  Save version
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleDuplicate()}>
                  <Copy className="mr-1.5 size-3.5" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={() => setForkOpen(true)}>
                  <GitFork className="mr-1.5 size-3.5" />
                  Fork
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleArchive()}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  {prompt.archived ? "Unarchive" : "Archive"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="font-mono text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-8">
          <PromptEditor key={editorKey} prompt={prompt} initialSections={sections} canEdit={isOwner} />
        </div>
      </motion.main>

      {isOwner && user && (
        <ForkModal
          open={forkOpen}
          onOpenChange={setForkOpen}
          prompt={prompt}
          actorId={user.id}
          onForked={(newId) => navigate(`/prompts/${newId}`)}
        />
      )}

      <VersionHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        prompt={prompt}
        isOwner={isOwner}
        onRestored={async () => {
          await refetch()
          setEditorKey((k) => k + 1)
        }}
        onDuplicated={(newId) => navigate(`/prompts/${newId}`)}
      />

      <Dialog
        open={saveOpen}
        onOpenChange={(o) => {
          setSaveOpen(o)
          if (!o) {
            setStale(false)
            setSaveError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Save version</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Snapshot all sections as a restorable version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="version-label" className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Label (optional)
            </Label>
            <Input
              id="version-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Tightened the system prompt"
              className="focus-visible:border-brand focus-visible:ring-brand/25"
            />
          </div>
          {stale && (
            <p className="font-mono text-xs text-amber-400">
              This prompt was saved by someone else since you opened it. Save anyway to append your version.
            </p>
          )}
          {saveError && <p className="font-mono text-xs text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            {stale ? (
              <Button
                onClick={() => void handleSave(true)}
                disabled={saveBusy}
                className="bg-amber-500 font-medium text-black hover:bg-amber-500/90"
              >
                {saveBusy ? "Saving…" : "Save anyway"}
              </Button>
            ) : (
              <Button
                onClick={() => void handleSave(false)}
                disabled={saveBusy}
                className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
              >
                {saveBusy ? "Saving…" : "Save version"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete “{prompt.title}”?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              This permanently removes the prompt and all its sections, versions, and comments. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
