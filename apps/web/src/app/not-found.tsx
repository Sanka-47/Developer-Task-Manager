import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        This page doesn’t exist
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The link may be broken, or the page may have moved. Head back to your
        dashboard to keep going.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "primary" }), "mt-2")}>
        Back to dashboard
      </Link>
    </main>
  );
}
