import { fmtMs, type SessionExportData } from "./data";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Self-contained printable HTML for the PDF export (MVP-24). Chromium's text
 * engine shapes Bangla correctly — the reason exports render via a browser.
 * Noto Sans Bengali loads from Google Fonts; the generator waits for fonts.
 */
export function buildExportHtml(data: SessionExportData): string {
  const meta = [
    data.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" }),
    data.durationSec ? `${Math.max(1, Math.ceil(data.durationSec / 60))} min` : null,
    data.tags.length ? data.tags.map(esc).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  const summary = data.summary
    ? `<h2>Summary</h2>
       <p>${esc(data.summary.overview)}</p>
       ${data.summary.decisions ? `<h3>Decisions</h3><p>${esc(data.summary.decisions)}</p>` : ""}
       ${data.summary.nextSteps ? `<h3>Next steps</h3><p>${esc(data.summary.nextSteps)}</p>` : ""}`
    : "";

  const actions = data.actionItems.length
    ? `<h2>Action items</h2>
       <ul class="actions">
         ${data.actionItems
           .map((i) => {
             const suffix = [i.owner, i.dueHint]
               .filter((v): v is string => Boolean(v))
               .map(esc)
               .join(" · ");
             return `<li><span class="box">${i.done ? "☑" : "☐"}</span> <span${i.done ? ' class="done"' : ""}>${esc(i.text)}${suffix ? ` <span class="muted">(${suffix})</span>` : ""}</span></li>`;
           })
           .join("")}
       </ul>`
    : "";

  const notes = data.notes.length
    ? `<h2>Notes</h2>
       <ul class="notes">
         ${data.notes
           .map(
             (n) =>
               `<li>${n.anchorMs !== null ? `<span class="time">[${fmtMs(n.anchorMs)}]</span> ` : ""}${esc(n.text)}</li>`,
           )
           .join("")}
       </ul>`
    : "";

  const transcript = data.transcript.length
    ? `<h2>Transcript</h2>
       ${data.transcript
         .map(
           (seg) => `
         <div class="seg">
           <div class="seg-meta">${fmtMs(seg.startMs)}${seg.speaker ? ` &middot; ${esc(seg.speaker)}` : ""}</div>
           <p>${esc(seg.text)}</p>
         </div>`,
         )
         .join("")}`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Inter", "Noto Sans Bengali", sans-serif;
    color: #1a212a; font-size: 10.5pt; line-height: 1.55; padding: 14mm 16mm;
  }
  .brand { color: #3b2c56; font-weight: 700; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { font-size: 17pt; font-weight: 700; margin: 6pt 0 2pt; }
  .meta { color: #738093; font-size: 8.5pt; margin-bottom: 14pt; }
  h2 { color: #3b2c56; font-size: 12pt; font-weight: 700; margin: 14pt 0 5pt; page-break-after: avoid; }
  h3 { font-size: 10.5pt; font-weight: 600; margin: 8pt 0 2pt; page-break-after: avoid; }
  p { margin-bottom: 5pt; }
  ul { list-style: none; }
  .actions li, .notes li { margin-bottom: 4pt; }
  .box { color: #3b2c56; }
  .done { text-decoration: line-through; color: #94a3b8; }
  .muted { color: #738093; }
  .time { font-family: ui-monospace, monospace; font-size: 8pt; color: #738093; }
  .seg { margin-bottom: 7pt; page-break-inside: avoid; }
  .seg-meta { font-family: ui-monospace, monospace; font-size: 7.5pt; color: #94a3b8; margin-bottom: 1pt; }
</style>
</head>
<body>
  <div class="brand">Doppio</div>
  <h1>${esc(data.title)}</h1>
  <div class="meta">${meta}</div>
  ${summary}
  ${actions}
  ${notes}
  ${transcript}
</body>
</html>`;
}
