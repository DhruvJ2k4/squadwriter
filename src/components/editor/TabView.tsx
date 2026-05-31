import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

function tabLabel(section: PromptSection): string {
  if (section.section_type === "rag_json") return "JSON"
  return section.title || (section.section_type === "main" ? "Main" : "Stage")
}

interface Props {
  sections: PromptSection[] // visible, ordered
  activeId: string
  onSelect: (id: string) => void
  renderPane: (section: PromptSection) => ReactNode
}

export function TabView({ sections, activeId, onSelect, renderPane }: Props) {
  const active = sections.find((s) => s.id === activeId) ?? sections[0]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60">
        {sections.map((section) => {
          const isActive = section.id === active?.id
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "relative px-3 py-2 font-mono text-xs transition-opacity",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tabLabel(section)}
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
            </button>
          )
        })}
      </div>

      {active && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pt-4"
        >
          {renderPane(active)}
        </motion.div>
      )}
    </div>
  )
}
