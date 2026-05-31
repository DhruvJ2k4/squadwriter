import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { applyMerge, mergeSegments, type MergeChoice, type MergeSegment } from "@/lib/diff"
import { cn } from "@/lib/utils"
import type { PromptSection } from "@/lib/types"

const CHOICES: { value: MergeChoice; label: string }[] = [
  { value: "host", label: "You" },
  { value: "other", label: "Them" },
  { value: "both", label: "Both" },
  { value: "drop", label: "Drop" },
]

function sectionLabel(s: PromptSection): string {
  if (s.section_type === "rag_json") return "JSON"
  return s.title || (s.section_type === "main" ? "Main" : "Stage")
}

interface Props {
  open: boolean
  hostSections: PromptSection[]
  otherSections: PromptSection[]
  otherName: string
  busy: boolean
  onFinalize: (merged: PromptSection[]) => void
  onCancel: () => void
}

export function MergeView({ open, hostSections, otherSections, otherName, busy, onFinalize, onCancel }: Props) {
  const hasOther = otherSections.length > 0
  const sectionMerges = useMemo(
    () =>
      [...hostSections]
        .sort((a, b) => a.position - b.position)
        .map((hs) => {
          const os = otherSections.find((o) => o.id === hs.id)
          return { section: hs, segments: mergeSegments(hs.content, os?.content ?? hs.content) }
        }),
    [hostSections, otherSections],
  )
  const [choices, setChoices] = useState<Record<string, MergeChoice>>({})

  function buildMerged(hostOnly: boolean): PromptSection[] {
    if (hostOnly) return hostSections
    return hostSections.map((hs) => {
      const sm = sectionMerges.find((m) => m.section.id === hs.id)
      if (!sm) return hs
      const c: Record<number, MergeChoice> = {}
      for (const seg of sm.segments) {
        if (seg.kind === "conflict") c[seg.id] = choices[`${hs.id}:${seg.id}`] ?? "host"
      }
      return { ...hs, content: applyMerge(sm.segments, c) }
    })
  }

  const conflictCount = sectionMerges.reduce(
    (n, sm) => n + sm.segments.filter((s) => s.kind === "conflict").length,
    0,
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/60 p-5">
          <DialogTitle className="font-display text-xl">Merge &amp; finalize</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {hasOther
              ? `Pick which side wins for each change, then finalize. ${conflictCount} change${conflictCount === 1 ? "" : "s"}.`
              : "No partner copy — your working copy will be saved as the new version."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-6 overflow-auto p-5">
          {!hasOther ? (
            <p className="font-mono text-xs text-muted-foreground">
              Finalizing your working copy. A new version will be saved.
            </p>
          ) : (
            sectionMerges
              .filter((sm) => !sm.section.archived)
              .map((sm) => (
                <div key={sm.section.id}>
                  <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {sectionLabel(sm.section)}
                  </p>
                  <div className="overflow-hidden rounded-md border border-border/60 font-mono text-xs">
                    {sm.segments.map((seg) => (
                      <SegmentRow
                        key={seg.id}
                        seg={seg}
                        otherName={otherName}
                        choice={choices[`${sm.section.id}:${seg.id}`] ?? "host"}
                        onChoice={(c) =>
                          setChoices((prev) => ({ ...prev, [`${sm.section.id}:${seg.id}`]: c }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>

        <DialogFooter className="border-t border-border/60 p-5">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onFinalize(buildMerged(true))}>
            Use my copy
          </Button>
          <Button
            disabled={busy}
            onClick={() => onFinalize(buildMerged(false))}
            className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
          >
            {busy ? "Finalizing…" : "Finalize merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SegmentRow({
  seg,
  otherName,
  choice,
  onChoice,
}: {
  seg: MergeSegment
  otherName: string
  choice: MergeChoice
  onChoice: (c: MergeChoice) => void
}) {
  if (seg.kind === "same") {
    if (seg.lines.length === 0) return null
    return <div className="whitespace-pre-wrap px-3 py-1 text-muted-foreground/70">{seg.lines.join("\n")}</div>
  }
  return (
    <div className="border-y border-border/40 bg-card/40">
      {seg.host.length > 0 && (
        <div className="whitespace-pre-wrap bg-brand/10 px-3 py-1">
          <span className="mr-2 text-[0.6rem] uppercase tracking-wider text-brand">you</span>
          {seg.host.join("\n")}
        </div>
      )}
      {seg.other.length > 0 && (
        <div className="whitespace-pre-wrap bg-emerald-500/10 px-3 py-1 text-emerald-300">
          <span className="mr-2 text-[0.6rem] uppercase tracking-wider">@{otherName}</span>
          {seg.other.join("\n")}
        </div>
      )}
      <div className="flex gap-1 px-3 py-1.5">
        {CHOICES.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChoice(opt.value)}
            className={cn(
              "rounded px-2 py-0.5 text-[0.65rem]",
              choice === opt.value
                ? "bg-brand text-brand-foreground"
                : "border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
