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
import type { NewPromptInput } from "@/hooks/usePrompt"
import type { PromptKind, PromptType } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: NewPromptInput) => Promise<{ error: string | null; id?: string }>
  onCreated?: (id: string) => void
}

const KINDS: { value: PromptKind; label: string; hint: string }[] = [
  { value: "conversation", label: "Conversation", hint: "A prompt the model runs as a conversation." },
  { value: "entity", label: "Entity", hint: "A single plain-markdown definition. No JSON or stages." },
]

const TYPES: { value: PromptType; label: string; hint: string }[] = [
  { value: "monolithic", label: "Monolithic", hint: "One single prompt section." },
  { value: "prompt_chaining", label: "Prompt chaining", hint: "A base prompt plus ordered stages." },
]

const labelClass = "font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"

function OptionCard({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border p-3 text-left transition-[transform,opacity] hover:-translate-y-0.5",
        selected ? "border-brand bg-brand/5" : "border-border/70 hover:border-border",
      )}
    >
      <p className={cn("text-sm font-medium", selected && "text-brand")}>{label}</p>
      <p className="mt-1 font-mono text-[0.7rem] leading-snug text-muted-foreground">{hint}</p>
    </button>
  )
}

export function NewPromptModal({ open, onOpenChange, onSubmit, onCreated }: Props) {
  const [kind, setKind] = useState<PromptKind>("conversation")
  const [type, setType] = useState<PromptType>("monolithic")
  const [addJson, setAddJson] = useState(false)
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setKind("conversation")
      setType("monolithic")
      setAddJson(false)
      setTitle("")
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Give your prompt a title.")
      return
    }
    const resolvedType: PromptType = kind === "entity" ? "entity" : type
    setBusy(true)
    setError(null)
    const res = await onSubmit({
      title,
      kind,
      type: resolvedType,
      hasJsonTab: kind === "conversation" ? addJson : false,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onOpenChange(false)
    if (res.id) onCreated?.(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New prompt</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Choose a kind, then a type. The right sections are created for you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label className={labelClass}>Kind</Label>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <OptionCard
                  key={k.value}
                  selected={kind === k.value}
                  label={k.label}
                  hint={k.hint}
                  onClick={() => setKind(k.value)}
                />
              ))}
            </div>
          </div>

          {kind === "conversation" && (
            <div className="space-y-2">
              <Label className={labelClass}>Type</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES.map((t) => (
                  <OptionCard
                    key={t.value}
                    selected={type === t.value}
                    label={t.label}
                    hint={t.hint}
                    onClick={() => setType(t.value)}
                  />
                ))}
              </div>
              <label className="mt-1 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 p-3 transition-[transform,opacity] hover:border-border">
                <input
                  type="checkbox"
                  checked={addJson}
                  onChange={(e) => setAddJson(e.target.checked)}
                  className="mt-0.5 size-4 accent-brand"
                />
                <span>
                  <span className="text-sm font-medium">Add RAG JSON</span>
                  <span className="mt-1 block font-mono text-[0.7rem] leading-snug text-muted-foreground">
                    Adds one JSON context section (with pretty-format). You can also toggle this later in
                    the editor.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="prompt-title" className={labelClass}>
              Title
            </Label>
            <Input
              id="prompt-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lead qualification system prompt"
              className="focus-visible:border-brand focus-visible:ring-brand/25"
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
              {busy ? "Creating…" : "Create prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
