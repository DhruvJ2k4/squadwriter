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

// --- line-level merge (Stage 12) -------------------------------------------

export type MergeChoice = "host" | "other" | "both" | "drop"

export type MergeSegment =
  | { id: number; kind: "same"; lines: string[] }
  | { id: number; kind: "conflict"; host: string[]; other: string[] }

function toLines(value: string): string[] {
  const lines = value.split("\n")
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines
}

/**
 * Segment a 2-way diff (host vs other) into "same" runs and "conflict" runs the
 * host resolves. A removed block (host's lines) pairs with the following added
 * block (other's lines) into one conflict.
 */
export function mergeSegments(hostText: string, otherText: string): MergeSegment[] {
  const changes = diffLines(hostText, otherText)
  const segments: MergeSegment[] = []
  let id = 0
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    if (!change.added && !change.removed) {
      segments.push({ id: id++, kind: "same", lines: toLines(change.value) })
      continue
    }
    if (change.removed) {
      const host = toLines(change.value)
      let other: string[] = []
      if (i + 1 < changes.length && changes[i + 1].added) {
        other = toLines(changes[i + 1].value)
        i++
      }
      segments.push({ id: id++, kind: "conflict", host, other })
    } else {
      // lone addition (other added lines the host doesn't have)
      segments.push({ id: id++, kind: "conflict", host: [], other: toLines(change.value) })
    }
  }
  return segments
}

/** Build the merged text from segments + the host's per-conflict choices (default: host). */
export function applyMerge(segments: MergeSegment[], choices: Record<number, MergeChoice>): string {
  const out: string[] = []
  for (const seg of segments) {
    if (seg.kind === "same") {
      out.push(...seg.lines)
      continue
    }
    const pick = choices[seg.id] ?? "host"
    if (pick === "host") out.push(...seg.host)
    else if (pick === "other") out.push(...seg.other)
    else if (pick === "both") out.push(...seg.host, ...seg.other)
    // "drop" → contribute nothing
  }
  return out.join("\n")
}
