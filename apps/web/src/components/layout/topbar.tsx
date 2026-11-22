"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

function pageTitle(pathname: string): string {
  if (pathname === "/") {
    return "Dashboard";
  }
  if (pathname === "/tasks") {
    return "Tasks";
  }
  if (pathname === "/board") {
    return "Board";
  }
  if (pathname.startsWith("/tasks/")) {
    return "Task details";
  }
  return "TaskApp";
}

export function Topbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="md:hidden">
          <Brand compact />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {pageTitle(pathname)}
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {pathname === "/board"
              ? "Drag and drop tasks between columns"
              : "Your workspace, organised."}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/tasks?new=1"
            className="hidden h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            New task
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
