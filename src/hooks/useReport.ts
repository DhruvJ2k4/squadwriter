import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { logActivity } from "@/hooks/useActivity"
import { sanitizeReportHtml } from "@/lib/sanitize"
import type { Report } from "@/lib/types"

type Result = { error: string | null; id?: string }

/** A project's HTML report(s) — one per project unless an admin raised max_reports (§3). */
export function useReport(projectId: string | undefined) {
  const { user } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [maxReports, setMaxReports] = useState(1)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const [{ data: rows }, { data: proj }] = await Promise.all([
      supabase
        .from("reports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase.from("projects").select("max_reports").eq("id", projectId).maybeSingle(),
    ])
    setReports(rows ?? [])
    setMaxReports(proj?.max_reports ?? 1)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createReport = useCallback(
    async (title: string): Promise<Result> => {
      if (!user || !projectId) return { error: "Not ready." }
      const { data, error } = await supabase
        .from("reports")
        .insert({ project_id: projectId, author_id: user.id, title: title.trim() || "Untitled report" })
        .select()
        .single()
      // The DB trigger enforces the per-project limit and raises if exceeded.
      if (error || !data) return { error: error?.message ?? "Could not create report." }
      await logActivity({ projectId, actorId: user.id, verb: "created a report", target: data.title })
      await refetch()
      return { error: null, id: data.id }
    },
    [user, projectId, refetch],
  )

  const saveDraft = useCallback(
    async (id: string, patch: { title?: string; html_source?: string }): Promise<Result> => {
      const { error } = await supabase.from("reports").update(patch).eq("id", id)
      if (error) return { error: error.message }
      await refetch()
      return { error: null, id }
    },
    [refetch],
  )

  /** Sanitize the draft into html_published, mark published, and mint a token if absent (§3.3). */
  const publish = useCallback(
    async (id: string, source: string, title: string): Promise<Result & { token?: string }> => {
      if (!user || !projectId) return { error: "Not ready." }
      const existing = reports.find((r) => r.id === id)
      const token = existing?.public_token ?? crypto.randomUUID()
      const { error } = await supabase
        .from("reports")
        .update({
          title: title.trim() || "Untitled report",
          html_source: source,
          html_published: sanitizeReportHtml(source),
          status: "published",
          published_at: new Date().toISOString(),
          public_token: token,
        })
        .eq("id", id)
      if (error) return { error: error.message }
      await logActivity({ projectId, actorId: user.id, verb: "published a report", target: title })
      await refetch()
      return { error: null, id, token }
    },
    [user, projectId, reports, refetch],
  )

  const unpublish = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from("reports").update({ status: "draft" }).eq("id", id)
      if (error) return { error: error.message }
      await refetch()
      return { error: null }
    },
    [refetch],
  )

  const deleteReport = useCallback(
    async (id: string): Promise<Result> => {
      const { error } = await supabase.from("reports").delete().eq("id", id)
      if (error) return { error: error.message }
      await refetch()
      return { error: null }
    },
    [refetch],
  )

  return {
    reports,
    maxReports,
    atLimit: reports.length >= maxReports,
    loading,
    refetch,
    createReport,
    saveDraft,
    publish,
    unpublish,
    deleteReport,
  }
}
