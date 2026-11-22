import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Loader2
        className={cn("h-4 w-4 animate-spin", className)}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
