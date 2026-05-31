import type { ReactNode } from "react"
import type { PromptSection } from "@/lib/types"

function sectionLabel(section: PromptSection): string {
  if (section.section_type === "rag_json") return "JSON"
  return section.title || (section.section_type === "main" ? "Main" : "Stage")
}

interface Props {
  sections: PromptSection[] // visible, ordered
  renderPane: (section: PromptSection) => ReactNode
}

export function ScrollView({ sections, renderPane }: Props) {
  function jumpTo(id: string) {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[9rem_1fr]">
      <nav className="top-4 hidden self-start sm:sticky sm:block">
        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Jump to
        </p>
        <div className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => jumpTo(section.id)}
              className="block w-full truncate text-left font-mono text-xs text-muted-foreground transition-opacity hover:text-foreground"
            >
              {sectionLabel(section)}
            </button>
          ))}
        </div>
      </nav>

      {/* min-w-0: this is the grid's 1fr item; without it grid `min-width:auto` lets the
          side-by-side editor+preview overflow its track and spill over the comments panel. */}
      <div className="min-w-0 space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={`section-${section.id}`} className="min-w-0 scroll-mt-4">
            <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              {sectionLabel(section)}
            </p>
            {renderPane(section)}
          </section>
        ))}
      </div>
    </div>
  )
}
