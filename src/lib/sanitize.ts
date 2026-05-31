import DOMPurify from "dompurify"

/**
 * Sanitize report HTML for publishing (§3.2). DOMPurify removes <script>, all
 * inline event handlers (onclick, onerror, …) and javascript:/data: script URIs
 * by default; we additionally forbid framing/embedding, external <link>/<base>/
 * <meta> and <form> so a published report stays a self-contained static document.
 * Inline <style> and style attributes are kept (and CSS-sanitized by DOMPurify).
 */
export function sanitizeReportHtml(source: string): string {
  return DOMPurify.sanitize(source, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "base", "meta", "link"],
    FORBID_ATTR: ["formaction", "ping"],
  })
}
