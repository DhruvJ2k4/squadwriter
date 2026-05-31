import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

interface Props {
  stages: PromptSection[] // all stage sections, including archived
  onAdd: () => void
  onRename: (stage: PromptSection, title: string) => void
  onArchiveToggle: (stage: PromptSection) => void
  onDelete: (stage: PromptSection) => void
}

export function StageDropdown({ stages, onAdd, onRename, onArchiveToggle, onDelete }: Props) {
  const activeCount = stages.filter((s) => !s.archived).length
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  function startEdit(stage: PromptSection) {
    setEditingId(stage.id)
    setDraft(stage.title || "")
  }

  function commit(stage: PromptSection) {
    const next = draft.trim()
    if (next && next !== (stage.title ?? "")) onRename(stage, next)
    setEditingId(null)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 font-mono text-xs">
          Stages · {activeCount}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="space-y-0.5">
          {stages.length === 0 ? (
            <p className="px-1 py-2 font-mono text-xs text-muted-foreground">No stages yet.</p>
          ) : (
            stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2 rounded px-1 py-1">
                {editingId === stage.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(stage)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commit(stage)
                      } else if (e.key === "Escape") {
                        e.preventDefault()
                        setEditingId(null)
                      }
                    }}
                    className="h-6 flex-1 rounded border border-brand/50 bg-transparent px-1.5 text-sm outline-none focus:border-brand"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(stage)}
                    title="Rename stage"
                    className={cn(
                      "flex-1 truncate text-left text-sm hover:text-brand",
                      stage.archived && "text-muted-foreground line-through",
                    )}
                  >
                    {stage.title || "Stage"}
                  </button>
                )}
                {editingId !== stage.id && (
                  <>
                    <button
                      onClick={() => startEdit(stage)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Rename stage"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => onArchiveToggle(stage)}
                      className="font-mono text-[0.7rem] text-muted-foreground hover:text-foreground"
                    >
                      {stage.archived ? "restore" : "archive"}
                    </button>
                    <button
                      onClick={() => onDelete(stage)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete stage"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <Button
          onClick={onAdd}
          size="sm"
          className="mt-2 w-full bg-brand font-medium text-brand-foreground hover:bg-brand/90"
        >
          <Plus className="mr-1.5 size-3.5" />
          Add stage
        </Button>
      </PopoverContent>
    </Popover>
  )
}
