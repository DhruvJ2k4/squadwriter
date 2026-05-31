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
import { Input } from "@/components/ui/input"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Heading, e.g. "Rename project". */
  title?: string
  initialValue: string
  onSubmit: (value: string) => Promise<{ error: string | null }>
}

/** Minimal single-field rename dialog, shared by project and prompt cards (CHANGESET §1.1). */
export function RenameDialog({ open, onOpenChange, title = "Rename", initialValue, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to the current name each time the dialog opens.
  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
      setBusy(false)
    }
  }, [open, initialValue])

  async function submit() {
    const next = value.trim()
    if (!next) {
      setError("Name can't be empty.")
      return
    }
    setBusy(true)
    setError(null)
    const res = await onSubmit(next)
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
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Give it a clear, recognizable name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void submit()
              }
            }}
            className="focus-visible:border-brand focus-visible:ring-brand/25"
          />
          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy}
            className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
