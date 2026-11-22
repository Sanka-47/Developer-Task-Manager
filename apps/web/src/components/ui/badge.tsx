import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral:
          "bg-muted text-muted-foreground ring-border/80",
        primary:
          "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15",
        success:
          "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
        warning:
          "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
        danger:
          "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
        info: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
        outline: "bg-transparent text-foreground ring-border",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
