import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function BillingPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      title="Billing"
      description="Plan management, usage meters, and upgrades — including local payment methods."
    />
  );
}
