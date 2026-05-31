import { autocompletion } from "@codemirror/autocomplete"
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete"
import type { EditorView } from "@codemirror/view"
import type { Extension } from "@codemirror/state"

export interface SlashCommand {
  label: string // e.g. "/section"
  detail: string
  /** Replace the typed "/command" (between `from` and `to`) and/or run a side effect. */
  apply: (view: EditorView, from: number, to: number) => void
}

/**
 * Slash-command autocomplete. Triggers on "/word" at line start or after
 * whitespace, so it doesn't fire inside words like "and/or".
 */
export function slashCommands(commands: SlashCommand[]): Extension {
  const source = (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/(^|\s)\/\w*/)
    if (!match) return null
    const slashIndex = match.text.indexOf("/")
    const from = match.from + slashIndex
    return {
      from,
      to: match.to,
      filter: true,
      options: commands.map((command) => ({
        label: command.label,
        detail: command.detail,
        type: "keyword",
        apply: (view: EditorView, _completion, applyFrom: number, applyTo: number) => {
          command.apply(view, applyFrom, applyTo)
        },
      })),
    }
  }

  return autocompletion({ override: [source], icons: false, defaultKeymap: true })
}
