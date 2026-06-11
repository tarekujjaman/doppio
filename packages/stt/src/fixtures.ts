import type { SttSegment } from "./types";

/**
 * Canonical Bangla / English / code-switch fixtures (MVP-27 spirit).
 * Used by the mock provider, seeds, and every AI-feature test.
 */

function toSegments(texts: string[]): SttSegment[] {
  return texts.map((text, i) => ({ startMs: i * 6000, endMs: i * 6000 + 5500, text }));
}

export const FIXTURE_BANGLA = {
  language: "bn",
  segments: toSegments([
    "আজকে আমরা ক্লাসে নিউটনের গতিসূত্র নিয়ে আলোচনা করব।",
    "প্রথম সূত্র বলে, বাহ্যিক বল প্রয়োগ না করলে স্থির বস্তু স্থির থাকে।",
    "দ্বিতীয় সূত্র হলো বল সমান ভর গুণ ত্বরণ।",
    "আগামী সপ্তাহে এই অধ্যায়ের উপর একটি পরীক্ষা হবে।",
    "সবাই অনুশীলনী তিন দশমিক দুই-এর অংকগুলো করে আনবে।",
  ]),
};

export const FIXTURE_ENGLISH = {
  language: "en",
  segments: toSegments([
    "Let's review the quarterly roadmap for the analytics dashboard.",
    "The data ingestion service is now stable after last week's fixes.",
    "Sadia will prepare the customer feedback report by Friday.",
    "We decided to postpone the mobile redesign to next quarter.",
    "Our next checkpoint is the demo on the twenty-eighth.",
  ]),
};

export const FIXTURE_CODE_SWITCH = {
  language: "mixed",
  segments: toSegments([
    "আজকের মিটিংয়ে আমরা database migration plan টা finalize করব।",
    "Staging environment-এ pgvector extension enable করা হয়েছে।",
    "ইমন বলেছে API rate limit নিয়ে একটা proposal লিখবে next Tuesday-র মধ্যে।",
    "আমরা decide করেছি Supabase free tier দিয়েই MVP launch করব।",
    "Deployment checklist টা সবাই review করে দেবে কালকের মধ্যে।",
  ]),
};

export const FIXTURES = {
  bn: FIXTURE_BANGLA,
  en: FIXTURE_ENGLISH,
  mixed: FIXTURE_CODE_SWITCH,
} as const;
