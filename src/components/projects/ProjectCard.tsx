import { Link } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ProjectWithRole } from "@/hooks/useProjects"
import type { MemberRole } from "@/lib/types"
import { cn } from "@/lib/utils"

const roleClass: Record<MemberRole, string> = {
  owner: "border-brand/40 text-brand",
  editor: "border-border text-foreground/80",
  checker: "border-border text-foreground/80",
  viewer: "border-border text-muted-foreground",
}

interface Props {
  project: ProjectWithRole
  onArchiveToggle: (project: ProjectWithRole) => void
}

export function ProjectCard({ project, onArchiveToggle }: Props) {
  const isOwner = project.myRole === "owner"

  return (
    <div className="group relative">
      <Link
        to={`/projects/${project.id}`}
        className="flex h-full flex-col rounded-lg border border-border/70 bg-card/50 p-5 transition-[transform,opacity] duration-200 will-change-transform hover:-translate-y-0.5 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight">
            {project.name}
          </h3>
          {project.client_name && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{project.client_name}</p>
          )}
          {project.use_case && (
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/90">{project.use_case}</p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {project.myRole && (
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[0.65rem] uppercase tracking-wider",
                roleClass[project.myRole],
              )}
            >
              {project.myRole}
            </Badge>
          )}
          {project.archived && (
            <Badge variant="outline" className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              archived
            </Badge>
          )}
        </div>
      </Link>

      {isOwner && (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Project actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono text-xs">
              <DropdownMenuItem onClick={() => onArchiveToggle(project)}>
                {project.archived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
