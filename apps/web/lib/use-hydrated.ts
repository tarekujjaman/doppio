"use client";

import { useEffect, useState } from "react";

/**
 * True once the component is hydrated client-side. Rendered into a
 * data-hydrated attribute so e2e tests can wait for interactivity
 * deterministically instead of racing React's event attachment.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
