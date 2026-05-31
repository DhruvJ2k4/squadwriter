import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProjects } from "@/hooks/useProjects"
import { forkPrompt } from "@/hooks/usePrompt"
import type { Prompt } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: Prompt
  actorId: string
  onForked: (newPromptId: string) => void
}

export function ForkModal({ open, onOpenChange, prompt, actorId, onForked }: Props) {
  const { projects } = useProjects()
  const authorable = projects.filter((p) => p.myRole === "owner" || p.myRole === "editor")
  const [target, setTarget] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default the target to the prompt's current project when available.
  useEffect(() => {
    if (open) {
      setError(null)
      const fallback = authorable.find((p) => p.id === prompt.project_id) ?? authorable[0]
      setTarget(fallback?.id ?? "")
    }
    // authorable is derived; depend on its serialised ids to avoid churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prompt.project_id, authorable.map((p) => p.id).join(",")])

  async function handleFork() {
    if (!target) return
    setBusy(true)
    setError(null)
    const res = await forkPrompt(actorId, prompt.id, target)
    setBusy(false)
    if (res.error || !res.id) {
      setError(res.error ?? "Could not fork prompt.")
      return
    }
    onOpenChange(false)
    onForked(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Fork “{prompt.title}”</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Clone this prompt and all its sections into another project as a fresh copy.
          </DialogDescription>
        </DialogHeader>

        {authorable.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            You need owner or editor access to a project before you can fork into it.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Target project
            </p>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project…" />
              </SelectTrigger>
              <SelectContent>
                {authorable.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.id === prompt.project_id ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && <p className="font-mono text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !target}
            onClick={() => void handleFork()}
            className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
          >
            {busy ? "Forking…" : "Fork prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
