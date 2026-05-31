import { StateEffect, StateField, type Extension } from "@codemirror/state"
import { Decoration, EditorView } from "@codemirror/view"

/** A comment's live anchor inside one editor. */
export interface AnchoredComment {
  id: string
  from: number
  to: number
  anchoredText: string
}

/** Reported back to React after each document change. */
export interface AnchorReport {
  id: string
  from: number
  to: number
  /** The anchored span's text no longer matches the original (partial edit). */
  textChanged: boolean
}

// React → editor: incremental updates that preserve live positions of untouched comments.
export const addComments = StateEffect.define<AnchoredComment[]>()
export const removeCommentEffect = StateEffect.define<string>()
export const resetComments = StateEffect.define<AnchoredComment[]>()

interface Callbacks {
  initial: AnchoredComment[]
  onReport: (reports: AnchorReport[], deletedIds: string[]) => void
  onSelect: (id: string) => void
}

export function commentLayer({ initial, onReport, onSelect }: Callbacks): Extension {
  const field = StateField.define<AnchoredComment[]>({
    create: () => initial,
    update(value, tr) {
      let next = value
      for (const effect of tr.effects) {
        if (effect.is(resetComments)) {
          next = effect.value
        } else if (effect.is(addComments)) {
          const existing = new Set(next.map((c) => c.id))
          next = [...next, ...effect.value.filter((c) => !existing.has(c.id))]
        } else if (effect.is(removeCommentEffect)) {
          next = next.filter((c) => c.id !== effect.value)
        }
      }
      if (tr.docChanged) {
        const mapped: AnchoredComment[] = []
        for (const c of next) {
          const from = tr.changes.mapPos(c.from, 1)
          const to = tr.changes.mapPos(c.to, -1)
          if (to <= from) continue // entire anchored span deleted → drop
          mapped.push({ ...c, from, to })
        }
        next = mapped
      }
      return next
    },
  })

  const decorations = EditorView.decorations.compute([field], (state) => {
    const comments = [...state.field(field)].sort((a, b) => a.from - b.from)
    const doc = state.doc
    const ranges = comments.map((c) => {
      const changed = doc.sliceString(c.from, c.to) !== c.anchoredText
      return Decoration.mark({
        class: changed ? "cm-comment cm-comment-changed" : "cm-comment",
        attributes: { "data-comment-id": c.id },
      }).range(c.from, c.to)
    })
    return Decoration.set(ranges, true)
  })

  // Report position/fate changes after each document change (never on our own effects).
  const reporter = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return
    const before = update.startState.field(field)
    const after = update.state.field(field)
    const afterIds = new Set(after.map((c) => c.id))
    const deletedIds = before.filter((c) => !afterIds.has(c.id)).map((c) => c.id)
    const doc = update.state.doc
    const reports: AnchorReport[] = after.map((c) => ({
      id: c.id,
      from: c.from,
      to: c.to,
      textChanged: doc.sliceString(c.from, c.to) !== c.anchoredText,
    }))
    onReport(reports, deletedIds)
  })

  const clicks = EditorView.domEventHandlers({
    mousedown: (event) => {
      const el = (event.target as HTMLElement).closest("[data-comment-id]")
      if (el) onSelect(el.getAttribute("data-comment-id") ?? "")
      return false
    },
  })

  return [field, decorations, reporter, clicks]
}
