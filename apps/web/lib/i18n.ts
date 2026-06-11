import type { Locale } from "@doppio/core";

/**
 * Tiny i18n dict (INIT-03 scaffold). All UI strings go through t() so the
 * full Bangla translation pass (INIT-04) is a dictionary edit, not a refactor.
 */
const dict = {
  en: {
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
  },
  bn: {
    "nav.dashboard": "ড্যাশবোর্ড",
    "nav.sessions": "সেশনসমূহ",
    "nav.search": "অনুসন্ধান",
    "nav.billing": "বিলিং",
    "nav.settings": "সেটিংস",
    "auth.signIn": "সাইন ইন",
    "auth.signOut": "সাইন আউট",
    "landing.tagline": "আপনার দ্বিতীয় সত্তা — যে শোনে, মনে রাখে এবং কাজ করে।",
    "common.loading": "লোড হচ্ছে…",
    "common.error": "কিছু একটা ভুল হয়েছে",
  },
} as const;

export type I18nKey = keyof (typeof dict)["en"];

export function t(locale: Locale, key: I18nKey): string {
  return dict[locale][key] ?? dict.en[key];
}

export const DEFAULT_LOCALE: Locale = "bn";
