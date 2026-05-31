import { useMemo } from "react"
import type { Extension } from "@codemirror/state"
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  value: string
  onChange: (value: string) => void
  editable: boolean
  themeExtension: Extension
}

/** The RAG JSON tab: a JSON editor with a validity indicator and pretty-print. */
export function JsonTab({ value, onChange, editable, themeExtension }: Props) {
  const valid = useMemo(() => {
    if (!value.trim()) return true
    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }, [value])

  function format() {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2))
    } catch {
      /* leave invalid JSON untouched */
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "font-mono text-[0.7rem]",
            valid ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {valid ? "Valid JSON" : "Invalid JSON"}
        </span>
        {editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={format}
            disabled={!valid}
            className="h-7 font-mono text-xs"
          >
            Format
          </Button>
        )}
      </div>
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        editable={editable}
        language="json"
        themeExtension={themeExtension}
        className="overflow-hidden rounded-md border border-border/60"
      />
    </div>
  )
}
