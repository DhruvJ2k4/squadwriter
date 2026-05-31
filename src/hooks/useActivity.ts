import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Activity } from "@/lib/types"

/**
 * Append an activity entry. Best-effort: activity is a non-critical audit trail,
 * so failures here never block the underlying action.
 */
export async function logActivity(input: {
  projectId: string
  actorId: string
  verb: string
  target?: string | null
}): Promise<void> {
  await supabase.from("activity").insert({
    project_id: input.projectId,
    actor_id: input.actorId,
    verb: input.verb,
    target: input.target ?? null,
  })
}

interface UseActivityOptions {
  /** Scope to one project's feed. */
  projectId?: string
  /** Scope to one actor (e.g. "recently edited by me"). */
  actorId?: string
  limit?: number
  /** Skip fetching until ready (e.g. waiting on the current user id). */
  enabled?: boolean
}

export function useActivity({ projectId, actorId, limit = 20, enabled = true }: UseActivityOptions) {
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    let q = supabase.from("activity").select("*")
    if (projectId) q = q.eq("project_id", projectId)
    if (actorId) q = q.eq("actor_id", actorId)
    const { data } = await q.order("created_at", { ascending: false }).limit(limit)
    setItems(data ?? [])
    setLoading(false)
  }, [projectId, actorId, limit, enabled])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { items, loading, refetch }
}
