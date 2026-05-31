import { diffLines, diffWordsWithSpace, type Change } from "diff"
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

// --- side-by-side diff (CHANGESET §2.6) ------------------------------------

export type DiffSegment = { text: string; changed: boolean }
export type SideCell = { type: "same" | "del" | "add" | "empty"; segments: DiffSegment[] }
export type DiffRow = { left: SideCell; right: SideCell }

const EMPTY_CELL: SideCell = { type: "empty", segments: [] }

/** Word-level segments for a changed line pair (whitespace preserved). */
function wordSegments(a: string, b: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const left: DiffSegment[] = []
  const right: DiffSegment[] = []
  for (const part of diffWordsWithSpace(a, b)) {
    if (part.added) right.push({ text: part.value, changed: true })
    else if (part.removed) left.push({ text: part.value, changed: true })
    else {
      left.push({ text: part.value, changed: false })
      right.push({ text: part.value, changed: false })
    }
  }
  return { left, right }
}

/**
 * Aligned side-by-side diff: removed lines pair with the following added lines
 * (with word-level highlighting on the changed pair); surplus lines on one side
 * leave the opposite cell empty. Powers the two-column red/green VersionDiff.
 */
export function sideBySideDiff(before: string, after: string): DiffRow[] {
  const changes = diffLines(before, after)
  const rows: DiffRow[] = []
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    if (!change.added && !change.removed) {
      for (const text of toLines(change.value)) {
        const seg = [{ text, changed: false }]
        rows.push({ left: { type: "same", segments: seg }, right: { type: "same", segments: seg } })
      }
      continue
    }
    if (change.removed) {
      const dels = toLines(change.value)
      let adds: string[] = []
      if (i + 1 < changes.length && changes[i + 1].added) {
        adds = toLines(changes[i + 1].value)
        i++
      }
      const n = Math.max(dels.length, adds.length)
      for (let r = 0; r < n; r++) {
        const d = dels[r]
        const a = adds[r]
        if (d !== undefined && a !== undefined) {
          const seg = wordSegments(d, a)
          rows.push({ left: { type: "del", segments: seg.left }, right: { type: "add", segments: seg.right } })
        } else if (d !== undefined) {
          rows.push({ left: { type: "del", segments: [{ text: d, changed: true }] }, right: EMPTY_CELL })
        } else {
          rows.push({ left: EMPTY_CELL, right: { type: "add", segments: [{ text: a, changed: true }] } })
        }
      }
    } else {
      // lone addition (no preceding removal)
      for (const text of toLines(change.value)) {
        rows.push({ left: EMPTY_CELL, right: { type: "add", segments: [{ text, changed: true }] } })
      }
    }
  }
  return rows
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
