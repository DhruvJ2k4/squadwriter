import { useMemo } from "react"
import { lineDiff, snapshotToText } from "@/lib/diff"
import { readSnapshotSections, type VersionWithAuthor } from "@/hooks/useVersions"
import { cn, formatRelativeTime } from "@/lib/utils"

interface Props {
  before: VersionWithAuthor
  after: VersionWithAuthor
}

export function VersionDiff({ before, after }: Props) {
  const lines = useMemo(() => {
    const a = snapshotToText(readSnapshotSections(before.snapshot))
    const b = snapshotToText(readSnapshotSections(after.snapshot))
    return lineDiff(a, b)
  }, [before, after])

  const adds = lines.filter((l) => l.type === "add").length
  const dels = lines.filter((l) => l.type === "del").length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[0.7rem] text-muted-foreground">
        <span>
          {before.label || "version"} · {formatRelativeTime(before.created_at)} → {after.label || "version"} ·{" "}
          {formatRelativeTime(after.created_at)}
        </span>
        <span>
          <span className="text-emerald-400">+{adds}</span>{" "}
          <span className="text-destructive">−{dels}</span>
        </span>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-md border border-border/60 bg-background font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="p-4 text-muted-foreground">No differences.</p>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 whitespace-pre-wrap break-words px-3 py-0.5",
                line.type === "add" && "bg-emerald-500/10 text-emerald-300",
                line.type === "del" && "bg-destructive/10 text-red-300",
                line.type === "same" && "text-muted-foreground/80",
              )}
            >
              <span className="select-none opacity-60">
                {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
              </span>
              <span className="flex-1">{line.text || " "}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
