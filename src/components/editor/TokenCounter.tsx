interface Props {
  text: string
}

/** Live char count + a rough token estimate (~chars/4, the common heuristic). */
export function TokenCounter({ text }: Props) {
  const chars = text.length
  const tokens = chars === 0 ? 0 : Math.max(1, Math.round(chars / 4))
  return (
    <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
      {chars.toLocaleString()} chars · ~{tokens.toLocaleString()} tokens
    </span>
  )
}
