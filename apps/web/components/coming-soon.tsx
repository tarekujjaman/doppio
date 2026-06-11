import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      <Card className="border-dashed shadow-none">
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <Icon className="h-6 w-6" />
          </div>
          <p className="font-medium text-slate-700">Coming soon</p>
          <p className="max-w-sm text-sm text-slate-500">{description}</p>
        </div>
      </Card>
    </div>
  );
}
