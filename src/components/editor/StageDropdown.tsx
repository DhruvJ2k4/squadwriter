import { Plus, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

interface Props {
  stages: PromptSection[] // all stage sections, including archived
  onAdd: () => void
  onArchiveToggle: (stage: PromptSection) => void
  onDelete: (stage: PromptSection) => void
}

export function StageDropdown({ stages, onAdd, onArchiveToggle, onDelete }: Props) {
  const activeCount = stages.filter((s) => !s.archived).length
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
                <span
                  className={cn(
                    "flex-1 truncate text-sm",
                    stage.archived && "text-muted-foreground line-through",
                  )}
                >
                  {stage.title || "Stage"}
                </span>
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
