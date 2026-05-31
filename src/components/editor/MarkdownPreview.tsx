import type { CSSProperties } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Palette } from "@/components/editor/ThemeSelector"
import { cn } from "@/lib/utils"

interface Props {
  source: string
  /** Drives the preview's colors so it matches the selected editor theme (§2.2). */
  palette: Palette
  className?: string
}

/**
 * Themed, live markdown preview. react-markdown renders to React elements (no raw HTML
 * injection). The preview's background, text, headings, links and code blocks are driven by
 * the active editor palette via Tailwind Typography's `--tw-prose-*` variables, so both panes
 * always match the chosen theme.
 */
export function MarkdownPreview({ source, palette, className }: Props) {
  const proseStyle = {
    color: palette.fg,
    "--tw-prose-body": palette.fg,
    "--tw-prose-headings": palette.heading,
    "--tw-prose-links": palette.link,
    "--tw-prose-bold": palette.fg,
    "--tw-prose-code": palette.variable,
    "--tw-prose-quotes": palette.comment,
    "--tw-prose-quote-borders": palette.gutter,
    "--tw-prose-bullets": palette.gutter,
    "--tw-prose-counters": palette.gutter,
    "--tw-prose-hr": palette.gutter,
    "--tw-prose-th-borders": palette.gutter,
    "--tw-prose-td-borders": palette.gutter,
    "--tw-prose-pre-code": palette.string,
    "--tw-prose-pre-bg": palette.dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.06)",
  } as CSSProperties

  return (
    <div
      className={cn("min-h-[14rem] overflow-auto rounded-md border border-border/60 px-4 py-3", className)}
      style={{ backgroundColor: palette.bg }}
    >
      {source.trim() ? (
        <article
          className="prose prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-code:before:content-none prose-code:after:content-none prose-pre:font-mono"
          style={proseStyle}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
        </article>
      ) : (
        <p className="font-mono text-xs" style={{ color: palette.comment }}>
          Nothing to preview yet.
        </p>
      )}
    </div>
  )
}
