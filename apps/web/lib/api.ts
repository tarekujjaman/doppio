import { NextResponse } from "next/server";

export const apiError = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message } }, { status });
