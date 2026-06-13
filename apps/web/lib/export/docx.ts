import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { fmtMs, type SessionExportData } from "./data";

const BRAND = "0F4C5C";
const MUTED = "64748B";

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, color: BRAND })],
  });
}

function body(text: string, opts: { color?: string; size?: number; bullet?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    ...(opts.bullet ? { bullet: { level: 0 } } : {}),
    children: [new TextRun({ text, color: opts.color, size: opts.size ?? 22 })], // size: half-points
  });
}

/** Session → DOCX (MVP-24). Word's own shaper renders Bangla correctly. */
export async function generateSessionDocx(data: SessionExportData): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Doppio", bold: true, color: BRAND, size: 20 })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [new TextRun({ text: data.title, bold: true })],
    }),
    body(
      [
        data.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" }),
        data.durationSec ? `${Math.max(1, Math.ceil(data.durationSec / 60))} min` : null,
        data.tags.length ? data.tags.join(", ") : null,
      ]
        .filter(Boolean)
        .join("  ·  "),
      { color: MUTED, size: 18 },
    ),
  ];

  if (data.summary) {
    children.push(heading("Summary"), body(data.summary.overview));
    if (data.summary.decisions) {
      children.push(body("Decisions", { color: MUTED, size: 18 }), body(data.summary.decisions));
    }
    if (data.summary.nextSteps) {
      children.push(body("Next steps", { color: MUTED, size: 18 }), body(data.summary.nextSteps));
    }
  }

  if (data.actionItems.length > 0) {
    children.push(heading("Action items"));
    for (const item of data.actionItems) {
      const suffix = [item.owner, item.dueHint].filter(Boolean).join(" · ");
      children.push(
        body(`${item.done ? "☑" : "☐"} ${item.text}${suffix ? ` (${suffix})` : ""}`, {
          bullet: true,
        }),
      );
    }
  }

  if (data.notes.length > 0) {
    children.push(heading("Notes"));
    for (const note of data.notes) {
      const anchor = note.anchorMs !== null ? `[${fmtMs(note.anchorMs)}] ` : "";
      children.push(body(`${anchor}${note.text}`, { bullet: true }));
    }
  }

  if (data.transcript.length > 0) {
    children.push(heading("Transcript"));
    for (const seg of data.transcript) {
      children.push(
        body(`${fmtMs(seg.startMs)}${seg.speaker ? ` · ${seg.speaker}` : ""}`, {
          color: MUTED,
          size: 16,
        }),
        body(seg.text),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
