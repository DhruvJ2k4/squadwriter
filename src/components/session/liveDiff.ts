import { StateEffect, StateField, type Extension } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import { diffWordsWithSpace } from "diff"

/** Push a new "peer" text for this editor to diff its document against. */
export const setPeerText = StateEffect.define<string>()

/** Word-level spans present in `self` but NOT in `peer` (offsets into `self`). */
function diffRanges(self: string, peer: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  let pos = 0
  for (const part of diffWordsWithSpace(peer, self)) {
    if (part.added) {
      ranges.push({ from: pos, to: pos + part.value.length })
      pos += part.value.length
    } else if (!part.removed) {
      pos += part.value.length
    }
    // removed parts live only in `peer`, so they don't advance `self`'s offset
  }
  return ranges
}

/**
 * Live word-level diff highlighting for a Live Session's two working copies (§2.7).
 * `kind: "added"` paints this editor's divergent spans green ("you added"); `"removed"`
 * paints them red ("present here, not in the other copy"). Recomputes on every document
 * change and whenever the peer text is updated (via `setPeerText`, or by reconfiguring the
 * extension with a fresh peer value).
 */
export function liveDiff(initialPeer: string, kind: "added" | "removed"): Extension {
  const peerField = StateField.define<string>({
    create: () => initialPeer,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(setPeerText)) value = e.value
      return value
    },
  })

  const mark = Decoration.mark({ class: kind === "added" ? "cm-live-add" : "cm-live-del" })

  const decorations = EditorView.decorations.compute(["doc", peerField], (state): DecorationSet => {
    const self = state.doc.toString()
    const peer = state.field(peerField)
    if (!self || self === peer) return Decoration.none
    const ranges = diffRanges(self, peer)
      .filter((r) => r.to > r.from)
      .map((r) => mark.range(r.from, r.to))
    return Decoration.set(ranges, true)
  })

  return [peerField, decorations]
}
