import DOMPurify from "dompurify"

/**
 * Sanitize a full client HTML report for publishing (§3.2) WHILE preserving its
 * design.
 *
 * `WHOLE_DOCUMENT: true` keeps <html>/<head>/<body> plus the <head>'s <style> and
 * <link> font/stylesheet tags. Without it, DOMPurify returns only the <body> inner
 * HTML and drops the entire <head> — so a report whose CSS lives in <head><style>
 * renders completely unstyled.
 *
 * Security is unchanged: DOMPurify still strips <script>, every inline on* handler
 * and javascript: URI; we additionally drop active-content tags (object/embed/
 * iframe), <base>, and meta-refresh (http-equiv). The published copy is also always
 * rendered in a no-scripts sandboxed iframe, so script execution is impossible
 * regardless of what survives here.
 */
export function sanitizeReportHtml(source: string): string {
  const clean = DOMPurify.sanitize(source, {
    WHOLE_DOCUMENT: true,
    // Keep head resources that drive the design (inline CSS + external fonts/CSS).
    ADD_TAGS: ["style", "link", "meta"],
    ADD_ATTR: ["rel", "href", "media", "crossorigin", "as", "sizes", "type", "charset", "name", "content"],
    FORBID_TAGS: ["script", "object", "embed", "base", "iframe"],
    FORBID_ATTR: ["http-equiv"], // block <meta http-equiv="refresh"> redirects
  })
  // DOMPurify drops the doctype; re-add it so the iframe renders in standards mode.
  return /^\s*<!doctype/i.test(clean) ? clean : `<!DOCTYPE html>\n${clean}`
}
