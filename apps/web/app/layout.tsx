import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doppio — your AI second self",
  description:
    "Bangla-first AI second brain: capture meetings and lectures, get summaries, action items, and answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
