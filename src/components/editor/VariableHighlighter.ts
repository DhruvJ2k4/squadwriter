import { Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view"
import type { DecorationSet, EditorView, ViewUpdate } from "@codemirror/view"

/**
 * Highlights `{{variable}}` spans with a mark decoration. Decorations are purely
 * presentational — they never change the document, so copy-paste yields the raw
 * `{{variable}}` text untouched.
 */
const variableMark = Decoration.mark({ class: "cm-variable" })

const matcher = new MatchDecorator({
  regexp: /\{\{\s*[\w.-]+\s*\}\}/g,
  decoration: variableMark,
})

export function variableHighlighter() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = matcher.createDeco(view)
      }
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
}
