import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { PresenceUser } from "@/hooks/usePresence"

export function PresenceBar({ users }: { users: PresenceUser[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.map((u) => (
          <Avatar key={u.userId} className="size-6 ring-2 ring-background">
            <AvatarFallback className="bg-secondary font-mono text-[0.55rem] uppercase">
              {u.username.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="font-mono text-[0.7rem] text-muted-foreground">
        {users.length} {users.length === 1 ? "person" : "people"} live
      </span>
    </div>
  )
}
