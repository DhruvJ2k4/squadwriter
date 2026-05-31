import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Copy, GitFork } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import {
  deletePromptRow,
  duplicatePrompt,
  setPromptArchivedRow,
  usePrompt,
} from "@/hooks/usePrompt"
import { ForkModal } from "@/components/prompts/ForkModal"
import { PromptEditor } from "@/components/editor/PromptEditor"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  const [forkOpen, setForkOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isOwner = !!prompt && prompt.owner_id === user?.id

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

          {isOwner && (
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          )}
        </div>

        <div className="mt-8">
          <PromptEditor prompt={prompt} initialSections={sections} canEdit={isOwner} />
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
