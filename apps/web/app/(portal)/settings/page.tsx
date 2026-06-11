import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function SettingsPage() {
  return (
    <ComingSoon
      icon={Settings}
      title="Settings"
      description="Profile, privacy controls including private mode, data export, and account management."
    />
  );
}
