import { Fragment, useMemo } from "react"
import { sideBySideDiff, snapshotToText, type SideCell } from "@/lib/diff"
import { readSnapshotSections, type VersionWithAuthor } from "@/hooks/useVersions"
import { cn, formatRelativeTime } from "@/lib/utils"

interface Props {
  before: VersionWithAuthor
  after: VersionWithAuthor
}

function Side({ cell, side }: { cell: SideCell; side: "left" | "right" }) {
  const sign = cell.type === "del" ? "−" : cell.type === "add" ? "+" : " "
  return (
    <div
      className={cn(
        "flex gap-2 whitespace-pre-wrap break-words px-3 py-0.5",
        side === "right" && "border-l border-border/60",
        cell.type === "del" && "bg-destructive/10 text-red-200",
        cell.type === "add" && "bg-emerald-500/10 text-emerald-200",
        cell.type === "same" && "text-muted-foreground/80",
        cell.type === "empty" && "bg-muted/20",
      )}
    >
      {cell.type !== "empty" && (
        <>
          <span className="select-none opacity-50">{sign}</span>
          <span className="flex-1">
            {cell.segments.length === 0
              ? " "
              : cell.segments.map((s, j) => (
                  <span
                    key={j}
                    className={cn(
                      s.changed && cell.type === "del" && "rounded-sm bg-destructive/30 text-red-100",
                      s.changed && cell.type === "add" && "rounded-sm bg-emerald-500/30 text-emerald-50",
                    )}
                  >
                    {s.text}
                  </span>
                ))}
          </span>
        </>
      )}
    </div>
  )
}

export function VersionDiff({ before, after }: Props) {
  const rows = useMemo(() => {
    const a = snapshotToText(readSnapshotSections(before.snapshot))
    const b = snapshotToText(readSnapshotSections(after.snapshot))
    return sideBySideDiff(a, b)
  }, [before, after])

  const adds = rows.filter((r) => r.right.type === "add").length
  const dels = rows.filter((r) => r.left.type === "del").length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[0.7rem] text-muted-foreground">
        <span>
          {before.label || "version"} · {formatRelativeTime(before.created_at)} → {after.label || "version"} ·{" "}
          {formatRelativeTime(after.created_at)}
        </span>
        <span>
          <span className="text-emerald-400">+{adds}</span> <span className="text-destructive">−{dels}</span>
        </span>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-md border border-border/60 bg-background">
        <div className="grid grid-cols-2 font-mono text-xs leading-relaxed">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-card/90 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground backdrop-blur">
            Before
          </div>
          <div className="sticky top-0 z-10 border-b border-l border-border/60 bg-card/90 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground backdrop-blur">
            After
          </div>
          {rows.length === 0 ? (
            <p className="col-span-2 p-4 text-muted-foreground">No differences.</p>
          ) : (
            rows.map((row, i) => (
              <Fragment key={i}>
                <Side cell={row.left} side="left" />
                <Side cell={row.right} side="right" />
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
