import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

interface Props {
  endsAt: string
  ended: boolean
  isHost: boolean
  onExtend: (minutes: number) => void
  onEnd: () => void
  onExpire?: () => void
}

export function SessionTimer({ endsAt, ended, isHost, onExtend, onEnd, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const remaining = new Date(endsAt).getTime() - now
  const isOver = ended || remaining <= 0

  // Fire once when the clock actually runs out (not when ended externally).
  const expiredRef = useRef(false)
  useEffect(() => {
    if (!ended && remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true
      onExpire?.()
    }
  }, [ended, remaining, onExpire])
  const warning = !isOver && remaining < 5 * 60000
  const mins = Math.max(0, Math.floor(remaining / 60000))
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000))

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          isOver ? "bg-muted-foreground" : warning ? "animate-pulse bg-destructive" : "bg-emerald-400",
        )}
      />
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          warning && "text-destructive",
          isOver && "text-muted-foreground",
        )}
      >
        {isOver ? "Ended" : `${pad(mins)}:${pad(secs)}`}
      </span>
      {warning && (
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-destructive">
          ending soon
        </span>
      )}
      {isHost && !isOver && (
        <>
          <Button variant="outline" size="sm" className="h-7 font-mono text-xs" onClick={() => onExtend(15)}>
            +15m
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 font-mono text-xs text-muted-foreground hover:text-destructive"
            onClick={onEnd}
          >
            End
          </Button>
        </>
      )}
    </div>
  )
}
