import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useVersions, type VersionWithAuthor } from "@/hooks/useVersions"
import { VersionDiff } from "@/components/prompts/VersionDiff"
import { cn, formatRelativeTime } from "@/lib/utils"
import type { Prompt } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: Prompt
  isOwner: boolean
  onRestored: () => void
  onDuplicated: (newPromptId: string) => void
}

export function VersionHistory({ open, onOpenChange, prompt, isOwner, onRestored, onDuplicated }: Props) {
  const { versions, loading, restoreVersion, duplicateAsNewPrompt, deleteVersion } = useVersions(prompt.id)
  const [selected, setSelected] = useState<string[]>([])
  const [diffPair, setDiffPair] = useState<[VersionWithAuthor, VersionWithAuthor] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id],
    )
  }

  function openDiff() {
    if (selected.length !== 2) return
    const a = versions.find((v) => v.id === selected[0])
    const b = versions.find((v) => v.id === selected[1])
    if (!a || !b) return
    const [before, after] =
      new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a]
    setDiffPair([before, after])
  }

  async function handleRestore(version: VersionWithAuthor) {
    if (!window.confirm("Restore this version? It replaces the prompt's current content.")) return
    setBusy(version.id)
    setError(null)
    const res = await restoreVersion(version, prompt)
    setBusy(null)
    if (res.error) {
      setError(res.error)
      return
    }
    onRestored()
    onOpenChange(false)
  }

  async function handleDuplicate(version: VersionWithAuthor) {
    setBusy(version.id)
    setError(null)
    const res = await duplicateAsNewPrompt(version, prompt)
    setBusy(null)
    if (res.error || !res.id) {
      setError(res.error ?? "Could not duplicate.")
      return
    }
    onOpenChange(false)
    onDuplicated(res.id)
  }

  async function handleDelete(version: VersionWithAuthor) {
    if (versions.length <= 1) return // never delete the only remaining version
    if (
      !window.confirm(
        "Delete this version permanently? Any comments anchored to this version are also removed. This can't be undone.",
      )
    )
      return
    setBusy(version.id)
    setError(null)
    const res = await deleteVersion(version, prompt)
    setBusy(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setSelected((prev) => prev.filter((x) => x !== version.id))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDiffPair(null)
          setSelected([])
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {diffPair ? "Compare versions" : "Version history"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {diffPair ? "Line-level diff." : "Select two versions to compare. Each Save is one version."}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="font-mono text-xs text-destructive">{error}</p>}

        {diffPair ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDiffPair(null)}
              className="font-mono text-xs"
            >
              ← Back to list
            </Button>
            <VersionDiff before={diffPair[0]} after={diffPair[1]} />
          </div>
        ) : loading ? (
          <p className="font-mono text-xs text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            No versions yet. Use “Save version” to snapshot this prompt.
          </p>
        ) : (
          <>
            <div className="max-h-[50vh] space-y-1 overflow-auto">
              {versions.map((version) => {
                const isSelected = selected.includes(version.id)
                return (
                  <div
                    key={version.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2",
                      isSelected ? "border-brand bg-brand/5" : "border-border/60",
                    )}
                  >
                    <button
                      onClick={() => toggleSelect(version.id)}
                      aria-label="Select for compare"
                      className={cn(
                        "size-4 shrink-0 rounded border",
                        isSelected ? "border-brand bg-brand" : "border-muted-foreground/50",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{version.label || "Untitled version"}</p>
                      <p className="font-mono text-[0.7rem] text-muted-foreground">
                        @{version.authorName} · {formatRelativeTime(version.created_at)}
                      </p>
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === version.id}
                          onClick={() => void handleRestore(version)}
                          className="font-mono text-xs"
                        >
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === version.id}
                          onClick={() => void handleDuplicate(version)}
                          className="font-mono text-xs"
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === version.id || versions.length <= 1}
                          onClick={() => void handleDelete(version)}
                          title={versions.length <= 1 ? "Can't delete the only version" : "Delete version"}
                          className="font-mono text-xs text-muted-foreground hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={openDiff}
                disabled={selected.length !== 2}
                className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
              >
                Compare selected ({selected.length}/2)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
