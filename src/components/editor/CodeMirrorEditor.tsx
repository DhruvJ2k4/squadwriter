import { useEffect, useRef } from "react"
import { Compartment, EditorState } from "@codemirror/state"
import type { Extension } from "@codemirror/state"
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete"
import { markdown } from "@codemirror/lang-markdown"
import { json } from "@codemirror/lang-json"
import {
  addComments,
  commentLayer,
  removeCommentEffect,
  type AnchoredComment,
  type AnchorReport,
} from "@/components/comments/CommentLayer"

const baseExtensions: Extension = [
  history(),
  drawSelection(),
  rectangularSelection(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  highlightActiveLine(),
  EditorView.lineWrapping,
  EditorView.theme({ ".cm-content": { minHeight: "14rem" } }),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
]

function languageExtension(language: "markdown" | "json"): Extension {
  return language === "json"
    ? [json(), lineNumbers(), highlightActiveLineGutter()]
    : [markdown()]
}

function editableExtension(editable: boolean): Extension {
  return [EditorView.editable.of(editable), EditorState.readOnly.of(!editable)]
}

export interface Selection {
  from: number
  to: number
}

interface Props {
  value: string
  onChange?: (value: string) => void
  editable?: boolean
  language?: "markdown" | "json"
  themeExtension: Extension
  extraExtensions?: Extension[]
  className?: string
  // Comment support (omit to disable, e.g. the JSON tab).
  comments?: AnchoredComment[]
  onCommentReport?: (reports: AnchorReport[], deletedIds: string[]) => void
  onCommentSelect?: (id: string) => void
  onSelectionChange?: (selection: Selection | null) => void
}

export function CodeMirrorEditor({
  value,
  onChange,
  editable = true,
  language = "markdown",
  themeExtension,
  extraExtensions = [],
  className,
  comments,
  onCommentReport,
  onCommentSelect,
  onSelectionChange,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onReportRef = useRef(onCommentReport)
  onReportRef.current = onCommentReport
  const onSelectRef = useRef(onCommentSelect)
  onSelectRef.current = onCommentSelect
  const onSelChangeRef = useRef(onSelectionChange)
  onSelChangeRef.current = onSelectionChange
  const prevComments = useRef<AnchoredComment[] | undefined>(comments)

  const themeComp = useRef(new Compartment())
  const langComp = useRef(new Compartment())
  const editableComp = useRef(new Compartment())
  const extraComp = useRef(new Compartment())

  // Mount once.
  useEffect(() => {
    if (!host.current) return
    const commentExtensions: Extension[] =
      comments !== undefined
        ? [
            commentLayer({
              initial: comments,
              onReport: (reports, deleted) => onReportRef.current?.(reports, deleted),
              onSelect: (id) => onSelectRef.current?.(id),
            }),
            EditorView.updateListener.of((update) => {
              if (update.selectionSet || update.docChanged) {
                const sel = update.state.selection.main
                onSelChangeRef.current?.(sel.empty ? null : { from: sel.from, to: sel.to })
              }
            }),
          ]
        : []

    const state = EditorState.create({
      doc: value,
      extensions: [
        baseExtensions,
        themeComp.current.of(themeExtension),
        langComp.current.of(languageExtension(language)),
        editableComp.current.of(editableExtension(editable)),
        extraComp.current.of(extraExtensions),
        ...commentExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
        }),
      ],
    })
    const editorView = new EditorView({ state, parent: host.current })
    view.current = editorView
    return () => {
      editorView.destroy()
      view.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes (JSON Format, restore, etc.).
  useEffect(() => {
    const editorView = view.current
    if (!editorView) return
    const current = editorView.state.doc.toString()
    if (value !== current) {
      editorView.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: themeComp.current.reconfigure(themeExtension) })
  }, [themeExtension])

  useEffect(() => {
    view.current?.dispatch({ effects: langComp.current.reconfigure(languageExtension(language)) })
  }, [language])

  useEffect(() => {
    view.current?.dispatch({ effects: editableComp.current.reconfigure(editableExtension(editable)) })
  }, [editable])

  useEffect(() => {
    view.current?.dispatch({ effects: extraComp.current.reconfigure(extraExtensions) })
  }, [extraExtensions])

  // Incrementally sync comments: add new, remove dismissed, preserve live positions of the rest.
  useEffect(() => {
    const editorView = view.current
    if (comments === undefined || !editorView) return
    const prev = prevComments.current ?? []
    const prevIds = new Set(prev.map((c) => c.id))
    const currIds = new Set(comments.map((c) => c.id))
    const added = comments.filter((c) => !prevIds.has(c.id))
    const removed = prev.filter((c) => !currIds.has(c.id)).map((c) => c.id)
    const effects = []
    if (added.length) effects.push(addComments.of(added))
    for (const id of removed) effects.push(removeCommentEffect.of(id))
    if (effects.length) editorView.dispatch({ effects })
    prevComments.current = comments
  }, [comments])

  return <div ref={host} className={className} />
}
