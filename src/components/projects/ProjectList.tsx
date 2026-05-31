import { ProjectCard } from "@/components/projects/ProjectCard"
import type { ProjectWithRole } from "@/hooks/useProjects"

interface Props {
  projects: ProjectWithRole[]
  onRename: (project: ProjectWithRole) => void
  onArchiveToggle: (project: ProjectWithRole) => void
}

export function ProjectList({ projects, onRename, onArchiveToggle }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onRename={onRename}
          onArchiveToggle={onArchiveToggle}
        />
      ))}
    </div>
  )
}
