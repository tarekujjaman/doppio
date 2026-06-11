import { ArrowRight, AudioLines, MessageCircleQuestion, Sparkles } from "lucide-react";
import Link from "next/link";

const FEATURES = [
  {
    icon: AudioLines,
    title: "Capture anywhere",
    body: "Record browser meetings with the Chrome extension or upload any recording. Doppio handles multilingual, code-switched speech that other tools drop.",
  },
  {
    icon: Sparkles,
    title: "Notes that write themselves",
    body: "Every session becomes a clean summary with decisions, next steps, action items, and smart tags — seconds after you stop recording.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Ask your memory",
    body: "Search every word ever said, or just ask. Answers come grounded in your own sessions, with timestamps that jump straight to the moment.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <span className="text-xl font-bold tracking-tight text-primary-800">Doppio</span>
        <Link
          href="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="bg-hero-glow">
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center">
          <p className="animate-fade-in text-sm font-semibold uppercase tracking-[0.2em] text-accent-600">
            Your AI second self
          </p>
          <h1 className="mt-4 animate-fade-up text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
            Every conversation,
            <br />
            <span className="text-primary-800">remembered forever.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-slate-600 [animation-delay:100ms]">
            Doppio listens to your meetings, lectures, and calls — then turns them into summaries,
            action items, and a searchable memory you can ask anything.
          </p>
          <div className="mt-10 flex animate-fade-up items-center justify-center gap-3 [animation-delay:200ms]">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary-800 px-7 text-base font-medium text-white shadow-card transition hover:bg-primary-700 hover:shadow-card-hover"
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-12 items-center rounded-xl border border-slate-300 bg-white px-7 text-base font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              See how it works
            </a>
          </div>
          <p className="mt-8 animate-fade-in text-xs text-slate-400 [animation-delay:350ms]">
            Free to start · No credit card · Built for multilingual, code-switched speech
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200/80 bg-white p-7 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition group-hover:bg-primary-800 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} Doppio</span>
          <span>Capture · Remember · Act</span>
        </div>
      </footer>
    </div>
  );
}
