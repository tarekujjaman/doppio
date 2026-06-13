import { prisma } from "@doppio/db";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { createClient } from "@/lib/supabase/server";

/** MVP-33: profile, privacy defaults, data export, account deletion. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? undefined },
    create: { id: user.id, email: user.email ?? null },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
      <SettingsForm
        initial={{
          email: profile.email,
          name: profile.name,
          privateMode: profile.privateMode,
        }}
      />
    </div>
  );
}
