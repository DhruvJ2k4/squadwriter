import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { logActivity } from "@/hooks/useActivity"
import type { MemberRole } from "@/lib/types"

export interface MemberRow {
  membershipId: string
  userId: string
  username: string
  email: string
  role: MemberRole
}

const ASSIGNABLE: MemberRole[] = ["editor", "checker", "viewer"]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  actorId: string
  members: MemberRow[]
  onChanged: () => void | Promise<void>
}

type SearchHit = { id: string; username: string; email: string }

export function MembersModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  actorId,
  members,
  onChanged,
}: Props) {
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [addRole, setAddRole] = useState<MemberRole>("viewer")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Debounced user search; PostgREST-significant chars are stripped to keep the
  // or() filter safe.
  useEffect(() => {
    if (!open) return
    const term = query.trim().replace(/[(),]/g, "")
    if (term.length < 2) {
      setHits([])
      setSearching(false)
      return
    }
    let active = true
    setSearching(true)
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, email")
        .or(`username.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8)
      if (!active) return
      setHits(data ?? [])
      setSearching(false)
    }, 250)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [query, open])

  const memberIds = new Set(members.map((m) => m.userId))
  const visibleHits = hits.filter((u) => !memberIds.has(u.id))

  async function addMember(u: SearchHit) {
    setBusyId(u.id)
    setError(null)
    const { error: e } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: u.id, role: addRole })
    setBusyId(null)
    if (e) {
      setError(e.message)
      return
    }
    await logActivity({ projectId, actorId, verb: `added ${addRole}`, target: u.username })
    setQuery("")
    setHits([])
    await onChanged()
  }

  async function changeRole(m: MemberRow, role: MemberRole) {
    setBusyId(m.membershipId)
    setError(null)
    const { error: e } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", m.membershipId)
    setBusyId(null)
    if (e) {
      setError(e.message)
      return
    }
    await logActivity({ projectId, actorId, verb: `set role to ${role}`, target: m.username })
    await onChanged()
  }

  async function removeMember(m: MemberRow) {
    setBusyId(m.membershipId)
    setError(null)
    const { error: e } = await supabase.from("project_members").delete().eq("id", m.membershipId)
    setBusyId(null)
    if (e) {
      setError(e.message)
      return
    }
    await logActivity({ projectId, actorId, verb: "removed member", target: m.username })
    await onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Members</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Manage who can access “{projectName}”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teammates by name or email…"
              className="font-mono focus-visible:border-brand focus-visible:ring-brand/25"
            />
            <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {query.trim().length >= 2 && (
            <div className="overflow-hidden rounded-md border border-border/60">
              {searching ? (
                <p className="p-3 font-mono text-xs text-muted-foreground">Searching…</p>
              ) : visibleHits.length === 0 ? (
                <p className="p-3 font-mono text-xs text-muted-foreground">No new matches.</p>
              ) : (
                visibleHits.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <UserBit username={u.username} email={u.email} />
                    <Button
                      size="sm"
                      disabled={busyId === u.id}
                      onClick={() => void addMember(u)}
                      className="bg-brand font-medium text-brand-foreground hover:bg-brand/90"
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {error && <p className="font-mono text-xs text-destructive">{error}</p>}

        <div className="space-y-2">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
            Current · {members.length}
          </p>
          <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
            {members.map((m) => (
              <div key={m.membershipId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <UserBit username={m.username} email={m.email} />
                {m.role === "owner" ? (
                  <span className="font-mono text-xs text-brand">owner</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={m.role}
                      onValueChange={(v) => void changeRole(m, v as MemberRole)}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === m.membershipId}
                      onClick={() => void removeMember(m)}
                      className="font-mono text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UserBit({ username, email }: { username: string; email: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-7">
        <AvatarFallback className="bg-secondary font-mono text-[0.6rem] uppercase">
          {username.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm">@{username}</p>
        <p className="truncate font-mono text-[0.7rem] text-muted-foreground">{email}</p>
      </div>
    </div>
  )
}
