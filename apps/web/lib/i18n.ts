/**
 * UI copy dictionary (English-only by product decision).
 * All strings route through t() so localization later (INIT-03 seam)
 * is a dictionary edit, not a refactor.
 */
const dict = {
  "nav.dashboard": "Dashboard",
  "nav.sessions": "Sessions",
  "nav.search": "Search",
  "nav.billing": "Billing",
  "nav.settings": "Settings",
  "auth.signIn": "Sign in",
  "auth.signOut": "Sign out",
  "landing.tagline": "Your second self — an AI double that listens, remembers, and acts.",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
} as const;

export type I18nKey = keyof typeof dict;

export function t(key: I18nKey): string {
  return dict[key];
}
