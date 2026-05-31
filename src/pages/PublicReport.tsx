import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { ReportFrame } from "@/components/reports/ReportFrame"

type Published = { title: string; html_published: string; published_at: string | null }

/**
 * Public, unauthenticated report page at /r/:token (§3.4). Reads ONE published
 * report via the token-gated SECURITY DEFINER RPC — no table access, no
 * enumeration, drafts never resolve.
 */
export function PublicReport() {
  const { token } = useParams()
  const [report, setReport] = useState<Published | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading")

  useEffect(() => {
    if (!token) {
      setState("missing")
      return
    }
    let active = true
    void supabase.rpc("get_published_report", { p_token: token }).then(({ data, error }) => {
      if (!active) return
      const row = Array.isArray(data) ? (data[0] as Published | undefined) : null
      if (error || !row) {
        setState("missing")
        return
      }
      setReport(row)
      setState("ready")
    })
    return () => {
      active = false
    }
  }, [token])

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <span className="font-mono text-xs text-muted-foreground">Loading…</span>
      </div>
    )
  }

  if (state === "missing" || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        <p className="font-display text-2xl">Report not found.</p>
        <p className="font-mono text-xs text-muted-foreground">
          This link may be invalid, or the report is no longer published.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-3">
        <span className="font-display text-sm font-semibold text-foreground">{report.title}</span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          SquadWriter
        </span>
      </header>
      <ReportFrame html={report.html_published} title={report.title} className="min-h-0 flex-1" />
    </div>
  )
}
