import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface PresenceUser {
  userId: string
  username: string
}

/** Tracks who is present on a Realtime presence channel. */
export function usePresence(channelName: string, me: PresenceUser | null) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!me) return
    const channel = supabase.channel(channelName, {
      config: { presence: { key: me.userId } },
    })
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ username: string }>()
        setUsers(
          Object.entries(state).map(([userId, metas]) => ({
            userId,
            username: metas[0]?.username ?? "?",
          })),
        )
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ username: me.username })
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelName, me?.userId, me?.username])

  return users
}
