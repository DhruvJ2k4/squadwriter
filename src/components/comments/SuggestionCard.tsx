import { Button } from "@/components/ui/button"

interface Props {
  anchoredText: string
  proposed: string
  canApply: boolean
  onApply: () => void
  onIgnore: () => void
}

/** Renders a suggestion's proposed replacement (original → proposed) + owner actions. */
export function SuggestionCard({ anchoredText, proposed, canApply, onApply, onIgnore }: Props) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">Replace</p>
        <p className="whitespace-pre-wrap break-words rounded bg-destructive/10 px-2 py-1 font-mono text-xs text-red-300 line-through decoration-destructive/60">
          {anchoredText}
        </p>
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">With</p>
        <p className="whitespace-pre-wrap break-words rounded bg-emerald-500/10 px-2 py-1 font-mono text-xs text-emerald-300">
          {proposed}
        </p>
      </div>
      {canApply && (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onApply()
            }}
            className="h-6 bg-brand px-2 font-mono text-[0.7rem] text-brand-foreground hover:bg-brand/90"
          >
            Apply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onIgnore()
            }}
            className="h-6 px-2 font-mono text-[0.7rem]"
          >
            Ignore
          </Button>
        </div>
      )}
    </div>
  )
}
