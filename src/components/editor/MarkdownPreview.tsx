import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Props {
  source: string
}

/** Themed, live markdown preview. react-markdown renders to React elements (no raw HTML injection). */
export function MarkdownPreview({ source }: Props) {
  return (
    <div className="min-h-[14rem] overflow-auto rounded-md border border-border/60 bg-card/30 px-4 py-3">
      {source.trim() ? (
        <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-brand prose-code:text-brand prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:font-mono">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
        </article>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">Nothing to preview yet.</p>
      )}
    </div>
  )
}
