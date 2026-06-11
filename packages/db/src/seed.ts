/**
 * Seeds a demo profile + two READY sessions (one Bangla, one English).
 * The demo user is display-only data — sign in with a real Supabase account for auth flows.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

const banglaSegments = [
  "আজকের sprint planning মিটিংয়ে আমরা Doppio-র upload pipeline নিয়ে আলোচনা করেছি।",
  "রাহাত বলেছে transcription API integration আগামী বৃহস্পতিবারের মধ্যে শেষ হবে।",
  "ফারিহা billing page-এর design রিভিউ করবে এবং feedback দেবে রবিবারের মধ্যে।",
  "আমরা সিদ্ধান্ত নিয়েছি যে free tier-এ মাসে ১২০ মিনিট transcription থাকবে।",
  "পরের মিটিং আগামী সোমবার সকাল দশটায়।",
];

const englishSegments = [
  "Welcome everyone to the weekly product sync for the Doppio web portal.",
  "The search index work is complete and deployed to staging.",
  "Tanvir will own the share-link feature and have a draft PR by Wednesday.",
  "We agreed to keep the Pro price at 250 taka per month for launch.",
  "Next sync is on Thursday at 4 PM.",
];

function segments(texts: string[]) {
  return texts.map((text, idx) => ({
    idx,
    startMs: idx * 8000,
    endMs: idx * 8000 + 7500,
    text,
  }));
}

async function main() {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo@doppio.example",
      name: "Demo User",
      locale: "bn",
    },
  });

  // Idempotent re-seed: wipe only the demo user's sessions.
  await prisma.session.deleteMany({ where: { userId: DEMO_USER_ID } });

  await prisma.session.create({
    data: {
      userId: DEMO_USER_ID,
      title: "স্প্রিন্ট প্ল্যানিং — আপলোড পাইপলাইন",
      source: "UPLOAD",
      status: "READY",
      language: "mixed",
      durationSec: 40,
      tags: ["sprint", "planning", "doppio"],
      transcript: { create: segments(banglaSegments) },
      summary: {
        create: {
          overview:
            "দলটি Doppio-র upload pipeline নিয়ে আলোচনা করেছে এবং transcription API integration ও billing design রিভিউয়ের দায়িত্ব ভাগ করা হয়েছে।",
          decisions: "Free tier-এ মাসে ১২০ মিনিট transcription থাকবে।",
          nextSteps: "রাহাত: API integration (বৃহস্পতিবার)। ফারিহা: billing design রিভিউ (রবিবার)।",
          language: "bn",
          model: "seed",
        },
      },
      actionItems: {
        create: [
          { text: "Transcription API integration শেষ করা", owner: "রাহাত", dueHint: "বৃহস্পতিবার" },
          { text: "Billing page design রিভিউ", owner: "ফারিহা", dueHint: "রবিবার" },
        ],
      },
      notes: {
        create: [{ anchorMs: 16000, text: "ফারিহার feedback-এর জন্য Figma link পাঠাতে হবে" }],
      },
    },
  });

  await prisma.session.create({
    data: {
      userId: DEMO_USER_ID,
      title: "Weekly product sync — web portal",
      source: "UPLOAD",
      status: "READY",
      language: "en",
      durationSec: 40,
      tags: ["product", "sync", "web"],
      transcript: { create: segments(englishSegments) },
      summary: {
        create: {
          overview:
            "Weekly sync covering search index completion, share-link ownership, and launch pricing.",
          decisions: "Pro price stays at Tk 250/month for launch.",
          nextSteps: "Tanvir drafts the share-link PR by Wednesday.",
          language: "en",
          model: "seed",
        },
      },
      actionItems: {
        create: [{ text: "Draft share-link feature PR", owner: "Tanvir", dueHint: "Wednesday" }],
      },
    },
  });

  const count = await prisma.session.count({ where: { userId: DEMO_USER_ID } });
  console.log(`Seeded demo user ${DEMO_USER_ID} with ${count} sessions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
