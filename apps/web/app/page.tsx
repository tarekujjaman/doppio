import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-white to-slate-50 px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-primary">Doppio</h1>
      <p className="max-w-xl text-lg text-slate-600">
        আপনার দ্বিতীয় সত্তা — মিটিং, লেকচার আর আলোচনাকে স্মৃতিতে বদলে দিন।
        <br />
        <span className="text-base text-slate-500">
          Your second self — an AI double that listens, remembers, and acts.
        </span>
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:opacity-90"
        >
          শুরু করুন · Get started
        </Link>
      </div>
      <p className="text-xs text-slate-400">Bangla-first · বাংলা + English code-switch ready</p>
    </main>
  );
}
