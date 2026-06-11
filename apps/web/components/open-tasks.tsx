"use client";

import { Check, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface OpenTask {
  id: string;
  text: string;
  owner: string | null;
  dueHint: string | null;
  done: boolean;
  session: { id: string; title: string };
}

/** MVP-05: aggregated open action items across sessions, check-off in place. */
export function OpenTasks({ initial }: { initial: OpenTask[] }) {
  const [tasks, setTasks] = useState(initial);

  async function toggle(task: OpenTask) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const res = await fetch(`/api/action-items/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    if (!res.ok) setTasks((prev) => [task, ...prev]);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <ListChecks className="h-4 w-4 text-slate-400" />
        <CardTitle>Open tasks</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">
            Nothing open — action items from new sessions land here.
          </p>
        ) : (
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                <button
                  onClick={() => void toggle(task)}
                  aria-label="Mark as done"
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    "border-slate-300 bg-white hover:border-primary-500 hover:bg-primary-50",
                  )}
                >
                  <Check className="h-3.5 w-3.5 text-transparent hover:text-primary-300" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-700">{task.text}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {[task.owner, task.dueHint].filter(Boolean).join(" · ")}
                    {(task.owner || task.dueHint) && " · "}
                    <Link
                      href={`/sessions/${task.session.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {task.session.title}
                    </Link>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
