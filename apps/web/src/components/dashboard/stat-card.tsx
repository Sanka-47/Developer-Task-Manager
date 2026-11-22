import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export type StatTone = "primary" | "neutral" | "info" | "success" | "danger";

const toneStyles: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  hint?: string;
  tone?: StatTone;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  tone = "neutral",
}: StatCardProps) {
  const content = (
    <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            toneStyles[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {hint ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${label}: ${value}. View matching tasks.`}
    >
      {content}
    </Link>
  );
}
