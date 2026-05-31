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
import { html } from "@codemirror/lang-html"
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

function languageExtension(language: "markdown" | "json" | "html"): Extension {
  if (language === "json") return [json(), lineNumbers(), highlightActiveLineGutter()]
  if (language === "html") return [html(), lineNumbers(), highlightActiveLineGutter()]
  return [markdown()]
}

function editableExtension(editable: boolean): Extension {
  return [EditorView.editable.of(editable), EditorState.readOnly.of(!editable)]
}

export interface Selection {
  from: number
  to: number
  /** Pixel position of the selection's end, relative to the editor's host element. */
  coords: { left: number; top: number; bottom: number } | null
}

interface Props {
  value: string
  onChange?: (value: string) => void
  editable?: boolean
  language?: "markdown" | "json" | "html"
  themeExtension: Extension
  extraExtensions?: Extension[]
  className?: string
  // Comment support (omit to disable, e.g. the JSON tab).
  comments?: AnchoredComment[]
  onCommentReport?: (reports: AnchorReport[], deletedIds: string[]) => void
  onCommentSelect?: (id: string) => void
  onSelectionChange?: (selection: Selection | null) => void
  /** Scroll a document position into view. Bump `revealNonce` each time to (re)trigger it. */
  revealPos?: number
  revealNonce?: number
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
  revealPos,
  revealNonce,
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
        // Report selection + its pixel position (inline comment composer §2.5, select-to-chat §2.7).
        EditorView.updateListener.of((update) => {
          const cb = onSelChangeRef.current
          if (!cb) return
          if (!update.selectionSet && !update.docChanged && !update.geometryChanged) return
          const sel = update.state.selection.main
          if (sel.empty) {
            cb(null)
            return
          }
          const hostRect = update.view.dom.getBoundingClientRect()
          const c = update.view.coordsAtPos(sel.to)
          cb({
            from: sel.from,
            to: sel.to,
            coords: c
              ? { left: c.left - hostRect.left, top: c.top - hostRect.top, bottom: c.bottom - hostRect.top }
              : null,
          })
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

  // Scroll the requested position into view (works for both the page-scrolled prompt editors
  // and the internally-scrolled session editors — we scroll the anchor's DOM node).
  useEffect(() => {
    if (revealNonce === undefined || revealPos === undefined) return
    const editorView = view.current
    if (!editorView) return
    const pos = Math.max(0, Math.min(revealPos, editorView.state.doc.length))
    requestAnimationFrame(() => {
      const v = view.current
      if (!v) return
      try {
        const dom = v.domAtPos(pos).node
        const el = dom.nodeType === Node.TEXT_NODE ? dom.parentElement : (dom as Element)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {
        /* position out of range after a concurrent edit — ignore */
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce])

  return <div ref={host} className={className} />
}
