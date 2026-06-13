/** Debug harness: exercise the PDF generator without HTTP/DB. */
import { writeFileSync } from "node:fs";
import { generateSessionPdf } from "../lib/export/pdf";
import type { SessionExportData } from "../lib/export/data";

const fake = {
  id: "x",
  title: "Share fixture — নিউটনের লেকচার",
  createdAt: new Date(),
  durationSec: 120,
  tags: ["physics", "নিউটন"],
  summary: {
    overview: "আজকের ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা হয়েছে। English mixed in too.",
    decisions: "আগামী সপ্তাহে পরীক্ষা হবে।",
    nextSteps: "অনুশীলনী ৩.২ শেষ করা।",
  },
  actionItems: [
    { text: "অনুশীলনী শেষ করা", owner: "রাহাত", dueHint: "শুক্রবার", done: false },
    { text: "Review the notes", owner: null, dueHint: null, done: true },
  ],
  notes: [{ text: "গুরুত্বপূর্ণ পয়েন্ট!", anchorMs: 12000 }],
  transcript: [
    { startMs: 0, speaker: null, text: "আজকে আমরা ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা করব।" },
    { startMs: 6000, speaker: "Speaker 1", text: "প্রথম সূত্র বলে বাহ্যিক বল ছাড়া স্থির বস্তু স্থির থাকে।" },
  ],
} as unknown as SessionExportData;

try {
  const bytes = await generateSessionPdf(fake);
  writeFileSync("test-output.pdf", bytes);
  console.log(`OK: ${bytes.length} bytes -> apps/web/test-output.pdf`);
  process.exit(0);
} catch (err) {
  console.error("PDF GENERATION FAILED:");
  console.error(err);
  process.exit(1);
}
