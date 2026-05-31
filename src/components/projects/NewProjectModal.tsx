import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectInput } from "@/hooks/useProjects"
import type { Project } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the modal is in edit mode and prefills from this project. */
  project?: Project | null
  onSubmit: (input: ProjectInput) => Promise<{ error: string | null }>
}

const labelClass = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
const inputClass = "focus-visible:border-brand focus-visible:ring-brand/25"

export function NewProjectModal({ open, onOpenChange, project, onSubmit }: Props) {
  const editing = !!project
  const [name, setName] = useState("")
  const [client, setClient] = useState("")
  const [useCase, setUseCase] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "")
      setClient(project?.client_name ?? "")
      setUseCase(project?.use_case ?? "")
      setError(null)
    }
  }, [open, project])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Project name is required.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await onSubmit({ name, client_name: client, use_case: useCase })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Edit project" : "New project"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {editing
              ? "Update this project's details."
              : "A project holds prompts for one client use-case."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className={labelClass}>
              Project name
            </Label>
            <Input
              id="proj-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Outreach Assistant"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-client" className={labelClass}>
              Client
            </Label>
            <Input
              id="proj-client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Acme Inc."
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-usecase" className={labelClass}>
              Use case
            </Label>
            <Textarea
              id="proj-usecase"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              placeholder="What will these prompts do?"
              rows={3}
              className={inputClass}
            />
          </div>

          {error && <p className="font-mono text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
