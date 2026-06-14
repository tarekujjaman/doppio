import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark, Wordmark } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { isAdminEmail } from "@/lib/admin";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const initial = (user.email?.[0] ?? "?").toUpperCase();
  const admin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <Mark size={26} />
            <Wordmark className="text-lg" />
          </Link>

          {/* min-w-0 lets the nav's overflow-x-auto engage instead of widening
              the page (flexbox min-width:auto would otherwise force horizontal
              scroll on phones — the M-mobile header overflow bug). */}
          <div className="min-w-0 flex-1">
            <NavLinks
              items={[
                { href: "/dashboard", label: t("nav.dashboard") },
                { href: "/sessions", label: t("nav.sessions") },
                { href: "/search", label: t("nav.search") },
                { href: "/billing", label: t("nav.billing") },
                { href: "/settings", label: t("nav.settings") },
                ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
              ]}
            />
          </div>

          <div className="flex items-center gap-3">
            <span
              title={user.email ?? undefined}
              className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-primary-800 text-sm font-semibold text-white"
            >
              {initial}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title={t("auth.signOut")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">{t("auth.signOut")}</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
