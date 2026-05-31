import { Link } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Prompt, PromptType } from "@/lib/types"

const TYPE_LABEL: Record<PromptType, string> = {
  monolithic: "Monolithic",
  prompt_chaining: "Chaining",
  rag_enabled: "RAG",
  entity: "Entity",
}

interface Props {
  prompts: Prompt[]
  currentUserId: string | undefined
  onArchiveToggle: (prompt: Prompt) => void
  onDuplicate: (prompt: Prompt) => void
  onFork: (prompt: Prompt) => void
  onDelete: (prompt: Prompt) => void
}

export function PromptList({
  prompts,
  currentUserId,
  onArchiveToggle,
  onDuplicate,
  onFork,
  onDelete,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {prompts.map((prompt) => {
        const isOwner = prompt.owner_id === currentUserId
        return (
          <div key={prompt.id} className="group relative">
            <Link
              to={`/prompts/${prompt.id}`}
              className="flex h-full flex-col rounded-lg border border-border/70 bg-card/50 p-4 transition-[transform,opacity] duration-200 will-change-transform hover:-translate-y-0.5 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <div className="flex items-start justify-between gap-2 pr-6">
                <h3 className="font-display text-base font-semibold leading-tight tracking-tight">
                  {prompt.title}
                </h3>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground"
                >
                  {TYPE_LABEL[prompt.prompt_type]}
                </Badge>
                {prompt.archived && (
                  <Badge
                    variant="outline"
                    className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground"
                  >
                    archived
                  </Badge>
                )}
                {!isOwner && (
                  <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground/70">
                    read-only
                  </span>
                )}
              </div>
            </Link>

            {isOwner && (
              <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Prompt actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="font-mono text-xs">
                    <DropdownMenuItem onClick={() => onDuplicate(prompt)}>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onFork(prompt)}>Fork to project…</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchiveToggle(prompt)}>
                      {prompt.archived ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(prompt)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
