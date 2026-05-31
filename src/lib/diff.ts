import { diffLines, type Change } from "diff"
import type { PromptSection } from "@/lib/types"

export type DiffLine = { type: "add" | "del" | "same"; text: string }

function sectionLabel(section: PromptSection): string {
  if (section.section_type === "rag_json") return "JSON"
  return section.title || (section.section_type === "main" ? "Main" : "Stage")
}

/** Flatten a snapshot's sections into a single diffable text (headers + content). */
export function snapshotToText(sections: PromptSection[]): string {
  return sections
    .filter((s) => !s.archived)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `### ${sectionLabel(s)}\n${s.content}`)
    .join("\n\n")
}

/** Line-level diff between two texts (jsdiff). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const changes: Change[] = diffLines(before, after)
  const out: DiffLine[] = []
  for (const change of changes) {
    const type: DiffLine["type"] = change.added ? "add" : change.removed ? "del" : "same"
    const lines = change.value.split("\n")
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    for (const text of lines) out.push({ type, text })
  }
  return out
}
