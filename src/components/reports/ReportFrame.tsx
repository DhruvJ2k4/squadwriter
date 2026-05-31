import { cn } from "@/lib/utils"

interface Props {
  html: string
  title?: string
  className?: string
}

/**
 * Renders report HTML inside a locked-down iframe. `sandbox=""` is the most
 * restrictive setting — NO scripts, forms, popups, same-origin access or
 * top-navigation (§3.2). Used for BOTH the edit preview (raw draft) and the
 * public page (sanitized copy), so even a draft <script> can never execute.
 */
export function ReportFrame({ html, title = "Report", className }: Props) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={html}
      className={cn("w-full border-0 bg-white", className)}
    />
  )
}
