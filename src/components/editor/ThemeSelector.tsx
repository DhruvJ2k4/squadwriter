import { type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags as t } from "@lezer/highlight"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Palette = {
  name: string
  dark: boolean
  bg: string
  fg: string
  caret: string
  selection: string
  gutter: string
  activeLine: string
  heading: string
  link: string
  keyword: string
  string: string
  comment: string
  number: string
  variable: string
  variableBg: string
}

const PALETTES: Palette[] = [
  {
    name: "Midnight",
    dark: true,
    bg: "#0d1117",
    fg: "#c9d1d9",
    caret: "#58a6ff",
    selection: "#264f7899",
    gutter: "#6e7681",
    activeLine: "rgba(255,255,255,0.03)",
    heading: "#79c0ff",
    link: "#a5d6ff",
    keyword: "#ff7b72",
    string: "#a5d6ff",
    comment: "#8b949e",
    number: "#79c0ff",
    variable: "#f0b429",
    variableBg: "rgba(240,180,41,0.15)",
  },
  {
    name: "Paper",
    dark: false,
    bg: "#f7f3ea",
    fg: "#3a342b",
    caret: "#b45309",
    selection: "#e6dabf",
    gutter: "#b8ad97",
    activeLine: "rgba(0,0,0,0.035)",
    heading: "#9a3412",
    link: "#0e7490",
    keyword: "#b91c1c",
    string: "#4d7c0f",
    comment: "#a8a29e",
    number: "#b45309",
    variable: "#9a3412",
    variableBg: "rgba(180,83,9,0.12)",
  },
  {
    name: "Terminal",
    dark: true,
    bg: "#0a0e0a",
    fg: "#7ee787",
    caret: "#56d364",
    selection: "#1b4721",
    gutter: "#3f6e46",
    activeLine: "rgba(86,211,100,0.06)",
    heading: "#b4f1b4",
    link: "#39d353",
    keyword: "#56d364",
    string: "#aff5b4",
    comment: "#4d7d52",
    number: "#56d364",
    variable: "#fde047",
    variableBg: "rgba(253,224,71,0.12)",
  },
  {
    name: "Amber",
    dark: true,
    bg: "#0c0a06",
    fg: "#e8d3a3",
    caret: "#f0b429",
    selection: "#3b2f12",
    gutter: "#6b5a32",
    activeLine: "rgba(240,180,41,0.05)",
    heading: "#f6c453",
    link: "#fbbf24",
    keyword: "#fbbf24",
    string: "#fde68a",
    comment: "#8a7a52",
    number: "#f6c453",
    variable: "#fef3c7",
    variableBg: "rgba(254,243,199,0.1)",
  },
]

function makeEditorTheme(p: Palette): Extension {
  const view = EditorView.theme(
    {
      "&": { color: p.fg, backgroundColor: p.bg, height: "100%" },
      ".cm-content": { caretColor: p.caret, fontFamily: "var(--font-mono)", padding: "12px 0" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: p.caret },
      "&.cm-focused": { outline: "none" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: p.selection,
      },
      ".cm-gutters": { backgroundColor: p.bg, color: p.gutter, border: "none" },
      ".cm-activeLine": { backgroundColor: p.activeLine },
      ".cm-activeLineGutter": { backgroundColor: p.activeLine },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
      // {{variable}} marks — decoration only, never alters the document text.
      ".cm-variable": {
        color: p.variable,
        backgroundColor: p.variableBg,
        borderRadius: "3px",
        padding: "0 2px",
      },
      ".cm-tooltip": {
        backgroundColor: p.dark ? "#161b22" : "#ffffff",
        border: "1px solid rgba(127,127,127,0.3)",
        borderRadius: "6px",
        color: p.fg,
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: p.variableBg,
        color: p.heading,
      },
    },
    { dark: p.dark },
  )

  const highlight = syntaxHighlighting(
    HighlightStyle.define([
      { tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4], color: p.heading, fontWeight: "600" },
      { tag: t.strong, color: p.fg, fontWeight: "700" },
      { tag: t.emphasis, color: p.fg, fontStyle: "italic" },
      { tag: [t.link, t.url], color: p.link, textDecoration: "underline" },
      { tag: t.quote, color: p.comment, fontStyle: "italic" },
      { tag: t.monospace, color: p.string },
      { tag: [t.keyword, t.atom, t.bool, t.null], color: p.keyword },
      { tag: [t.string, t.special(t.string)], color: p.string },
      { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: "italic" },
      { tag: t.number, color: p.number },
      { tag: t.propertyName, color: p.heading },
      { tag: [t.punctuation, t.separator], color: p.gutter },
      { tag: t.list, color: p.link },
    ]),
  )

  return [view, highlight]
}

export type EditorTheme = { name: string; extension: Extension }

export const EDITOR_THEMES: EditorTheme[] = PALETTES.map((p) => ({
  name: p.name,
  extension: makeEditorTheme(p),
}))

export const DEFAULT_THEME_NAME = EDITOR_THEMES[0].name

export function getThemeExtension(name: string): Extension {
  return (EDITOR_THEMES.find((th) => th.name === name) ?? EDITOR_THEMES[0]).extension
}

export function ThemeSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (name: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-32 font-mono text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EDITOR_THEMES.map((th) => (
          <SelectItem key={th.name} value={th.name} className="font-mono text-xs">
            {th.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
