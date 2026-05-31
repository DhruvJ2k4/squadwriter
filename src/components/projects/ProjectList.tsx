import { ProjectCard } from "@/components/projects/ProjectCard"
import type { ProjectWithRole } from "@/hooks/useProjects"

interface Props {
  projects: ProjectWithRole[]
  onArchiveToggle: (project: ProjectWithRole) => void
}

export function ProjectList({ projects, onArchiveToggle }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onArchiveToggle={onArchiveToggle} />
      ))}
    </div>
  )
}
