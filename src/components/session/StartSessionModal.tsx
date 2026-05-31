import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { startSession } from "@/hooks/useSession"
import { cn } from "@/lib/utils"
import type { Prompt, PromptSection } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: Prompt
  sections: PromptSection[]
  onStarted: (sessionId: string) => void
}

type Member = { id: string; username: string; email: string }
const PRESETS = [40, 60]

export function StartSessionModal({ open, onOpenChange, prompt, sections, onStarted }: Props) {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [inviteeId, setInviteeId] = useState<string>("")
  const [duration, setDuration] = useState<number>(40)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    let active = true
    void (async () => {
      const { data } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", prompt.project_id)
      const ids = (data ?? []).map((m) => m.user_id).filter((id) => id !== user?.id)
      if (!ids.length) {
        if (active) setMembers([])
        return
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", ids)
      if (active) setMembers((profiles ?? []).map((p) => ({ id: p.id, username: p.username, email: p.email })))
    })()
    return () => {
      active = false
    }
  }, [open, prompt.project_id, user?.id])

  async function start() {
    if (!user || !inviteeId || duration < 1) {
      setError("Pick a teammate and a duration.")
      return
    }
    setBusy(true)
    setError(null)
    const endsAtIso = new Date(Date.now() + duration * 60000).toISOString()
    const res = await startSession({
      hostId: user.id,
      promptId: prompt.id,
      sections,
      inviteeId,
      durationMinutes: duration,
      endsAtIso,
    })
    setBusy(false)
    if (res.error || !res.sessionId) {
      setError(res.error ?? "Could not start session.")
      return
    }
    onOpenChange(false)
    onStarted(res.sessionId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start a live session</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Invite a teammate to co-edit. You'll each get your own working copy to merge at the end.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Invite
            </Label>
            {members.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                No other members on this project to invite.
              </p>
            ) : (
              <Select value={inviteeId} onValueChange={setInviteeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a teammate…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      @{m.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Duration (minutes)
            </Label>
            <div className="flex items-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDuration(p)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 font-mono text-xs transition-[transform,opacity] hover:-translate-y-0.5",
                    duration === p ? "border-brand text-brand" : "border-border/70 text-muted-foreground",
                  )}
                >
                  {p === 60 ? "1h" : `${p}m`}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
                className="h-9 w-24 font-mono focus-visible:border-brand focus-visible:ring-brand/25"
              />
            </div>
          </div>

          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || !inviteeId}
            onClick={() => void start()}
            className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
          >
            {busy ? "Starting…" : "Start session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
