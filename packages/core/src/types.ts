/** Mirrors prisma enums — kept here so client code avoids importing @prisma/client. */
export const SESSION_STATUSES = [
  "RECORDING",
  "UPLOADED",
  "TRANSCRIBING",
  "SUMMARIZING",
  "READY",
  "FAILED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_SOURCES = ["EXTENSION", "UPLOAD", "TEXT_IMPORT", "MOBILE"] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

export type Locale = "bn" | "en";

export type LanguageTag = "bn" | "en" | "mixed";

export interface TranscriptSegmentDto {
  idx: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** Standard API error envelope: { error: { code, message } } */
export interface ApiError {
  error: { code: string; message: string };
}

export const UPLOAD_ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/flac",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
] as const;
