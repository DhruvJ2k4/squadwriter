import { useEffect, useState } from "react"
import type { Tiktoken } from "js-tiktoken/lite"

interface Props {
  text: string
}

// Build the GPT-4 (cl100k_base) encoder once, lazily, off the editor's critical path.
// The rank table is ~1.7MB, so we dynamic-import it only when a token count is first needed
// (and reuse the single instance across every mount/keystroke after that).
let encoderPromise: Promise<Tiktoken> | null = null
function getEncoder(): Promise<Tiktoken> {
  if (!encoderPromise) {
    encoderPromise = Promise.all([
      import("js-tiktoken/lite"),
      import("js-tiktoken/ranks/cl100k_base"),
    ]).then(([{ Tiktoken }, ranks]) => new Tiktoken(ranks.default))
  }
  return encoderPromise
}

/**
 * Live char count + an accurate GPT-4 token count using js-tiktoken's `cl100k_base` encoding
 * (the GPT-4 / GPT-3.5 tokenizer). Tokenization is debounced (250ms) and async, so it never
 * runs synchronously per keystroke (latency rule); the char count stays instant, and the last
 * token count is kept visible while you type rather than flickering.
 */
export function TokenCounter({ text }: Props) {
  const chars = text.length
  const [tokens, setTokens] = useState<number | null>(null)

  useEffect(() => {
    if (text.length === 0) {
      setTokens(0)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void getEncoder().then((enc) => {
        if (cancelled) return
        try {
          setTokens(enc.encode(text).length)
        } catch {
          /* keep the previous count if encoding ever fails */
        }
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [text])

  return (
    <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
      {chars.toLocaleString()} chars · {tokens === null ? "…" : tokens.toLocaleString()} tokens
    </span>
  )
}
