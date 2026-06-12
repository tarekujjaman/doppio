import { Fragment } from "react";

/** Renders [[m]]…[[/m]] highlight markers as <mark> — no raw HTML injection. */
export function SearchSnippet({ text }: { text: string }) {
  const parts = text.split(/\[\[m\]\]|\[\[\/m\]\]/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-accent-100 px-0.5 text-accent-900">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
