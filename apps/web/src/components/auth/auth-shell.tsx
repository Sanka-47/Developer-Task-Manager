import type { ReactNode } from "react";

import { Brand } from "@/components/layout/sidebar";

const highlights = [
  {
    title: "Everything in one place",
    description: "Dashboard, list and board views over the same live data.",
  },
  {
    title: "Built for focus",
    description: "Search, filter and sort without losing your place.",
  },
  {
    title: "Secure by default",
    description: "Short-lived access tokens and rotating refresh sessions.",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col">
        <div className="auth-grid absolute inset-0 opacity-90" aria-hidden="true" />
        <div
          className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col p-10 xl:p-14">
          <Brand />

          <div className="my-auto max-w-lg py-12">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Your day, under control
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Turn plans into
              <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-sky-300 bg-clip-text text-transparent">
                visible progress.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/65">
              A calm, fast workspace for the work that matters. Capture tasks,
              keep priorities honest and see momentum build.
            </p>

            <ul className="mt-10 space-y-5">
              {highlights.map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                      <path
                        d="M4 10.5 8 14.5 16 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm text-white/55">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/40">
            TaskApp — a full-stack task management demo built with Next.js,
            Express, Prisma and PostgreSQL.
          </p>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Brand />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
