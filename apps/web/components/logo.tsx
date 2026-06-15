import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Doppio mark — two overlapping circles: "you" (plum) + "the echo" (coral),
 * with "the spark" lens where they overlap. From Doppio_Logo_System.html.
 *   - color: full colour (light surfaces)
 *   - rev:   reversed "you" circle (paper) for dark/plum surfaces
 *   - mono:  single-colour via currentColor
 */
export function Mark({
  variant = "color",
  size = 24,
  className,
}: {
  variant?: "color" | "rev" | "mono";
  size?: number;
  className?: string;
}) {
  const clipId = `dop-${useId().replace(/:/g, "")}`;

  if (variant === "mono") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
        <circle cx="42" cy="46" r="26" fill="currentColor" />
        <circle cx="62" cy="58" r="22" fill="currentColor" fillOpacity="0.78" />
      </svg>
    );
  }

  const you = variant === "rev" ? "#F3EEE9" : "#3B2C56";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx="42" cy="46" r="26" />
        </clipPath>
      </defs>
      <circle cx="42" cy="46" r="26" fill={you} />
      <circle cx="62" cy="58" r="22" fill="#F0664A" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="62" cy="58" r="22" fill="#F4A47E" />
      </g>
    </svg>
  );
}

/**
 * "Doppio" with the second p in coral (the echo). Defaults to plum text;
 * pass a text-* class to recolour (e.g. text-paper on dark surfaces) and a
 * text-{size}/font class to resize — tailwind-merge lets callers override.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight text-primary-800", className)}>
      Dop<span className="text-accent-500">p</span>io
    </span>
  );
}

/** Mark + Wordmark side by side — the standard brand lockup. */
export function Lockup({
  size = 26,
  variant = "color",
  className,
  wordmarkClassName,
}: {
  size?: number;
  variant?: "color" | "rev" | "mono";
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mark variant={variant} size={size} />
      <Wordmark className={wordmarkClassName} />
    </span>
  );
}
