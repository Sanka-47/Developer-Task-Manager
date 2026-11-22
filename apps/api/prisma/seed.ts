import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@taskapp.dev";
const DEMO_PASSWORD = "Demo1234!";
const BCRYPT_ROUNDS = 12;

type SeedTask = {
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  /** Days from today. `null` means no due date. */
  dueInDays: number | null;
  /** UTC hour for the due date (defaults to 12:00). */
  dueHour?: number;
  createdDaysAgo: number;
  completedDaysAgo?: number;
};

const seedTasks: SeedTask[] = [
  {
    title: "Finalise Q4 product roadmap",
    description:
      "Consolidate feedback from sales, support and design into a prioritised roadmap for the next quarter.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueInDays: 2,
    createdDaysAgo: 6,
  },
  {
    title: "Fix pagination bug on the reports page",
    description:
      "Changing the page size resets the current page and occasionally duplicates rows.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueInDays: -1,
    createdDaysAgo: 4,
  },
  {
    title: "Write onboarding documentation",
    description:
      "Cover local setup, environment variables, database migrations and the deployment checklist.",
    status: "TODO",
    priority: "MEDIUM",
    dueInDays: 5,
    createdDaysAgo: 3,
  },
  {
    title: "Review pull request #482",
    description:
      "Authentication refactor. Focus on refresh-token rotation and error handling.",
    status: "TODO",
    priority: "HIGH",
    dueInDays: 0,
    dueHour: 23,
    createdDaysAgo: 1,
  },
  {
    title: "Upgrade PostgreSQL to 16",
    description:
      "Test the upgrade path on staging, take a snapshot, then schedule the production window.",
    status: "TODO",
    priority: "MEDIUM",
    dueInDays: 9,
    createdDaysAgo: 8,
  },
  {
    title: "Add end-to-end tests for checkout",
    description:
      "Cover the happy path, declined card and expired cart scenarios with Playwright.",
    status: "TODO",
    priority: "MEDIUM",
    dueInDays: 12,
    createdDaysAgo: 5,
  },
  {
    title: "Design empty states for the dashboard",
    description:
      "Provide illustrations and copy for new accounts with no tasks or activity yet.",
    status: "TODO",
    priority: "LOW",
    dueInDays: 14,
    createdDaysAgo: 9,
  },
  {
    title: "Audit third-party dependencies",
    description:
      "Run npm audit, review licences and remove packages that are no longer maintained.",
    status: "TODO",
    priority: "LOW",
    dueInDays: null,
    createdDaysAgo: 15,
  },
  {
    title: "Set up staging environment",
    description:
      "Provision the database, configure secrets and wire up automatic deploys from main.",
    status: "COMPLETED",
    priority: "HIGH",
    dueInDays: -6,
    createdDaysAgo: 20,
    completedDaysAgo: 7,
  },
  {
    title: "Migrate authentication to httpOnly cookies",
    description:
      "Replace localStorage refresh tokens with rotating httpOnly cookies and keep access tokens in memory.",
    status: "COMPLETED",
    priority: "HIGH",
    dueInDays: -3,
    createdDaysAgo: 12,
    completedDaysAgo: 4,
  },
  {
    title: "Add request validation middleware",
    description:
      "Validate body, query and route params with Zod and return consistent error payloads.",
    status: "COMPLETED",
    priority: "MEDIUM",
    dueInDays: -8,
    createdDaysAgo: 18,
    completedDaysAgo: 9,
  },
  {
    title: "Improve dashboard loading skeletons",
    description:
      "Replace spinners with layout-matched skeletons to reduce perceived latency.",
    status: "COMPLETED",
    priority: "LOW",
    dueInDays: -10,
    createdDaysAgo: 22,
    completedDaysAgo: 11,
  },
  {
    title: "Fix timezone handling for due dates",
    description:
      "Due dates were rendered a day early for users in negative UTC offsets.",
    status: "COMPLETED",
    priority: "MEDIUM",
    dueInDays: -2,
    createdDaysAgo: 7,
    completedDaysAgo: 2,
  },
  {
    title: "Plan accessibility review",
    description:
      "Schedule a keyboard and screen-reader pass over the task table, filters and dialogs.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    dueInDays: 6,
    createdDaysAgo: 2,
  },
  {
    title: "Refactor API error handling",
    description:
      "Centralise error mapping for validation, Prisma and unexpected failures.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueInDays: 1,
    createdDaysAgo: 3,
  },
  {
    title: "Draft release notes for v1.2",
    description:
      "Summarise the new Kanban board, optimistic updates and dark mode support.",
    status: "TODO",
    priority: "LOW",
    dueInDays: 4,
    createdDaysAgo: 1,
  },
  {
    title: "Investigate slow dashboard query",
    description:
      "The summary endpoint takes 800ms on large accounts. Add indexes and measure again.",
    status: "TODO",
    priority: "HIGH",
    dueInDays: -2,
    createdDaysAgo: 10,
  },
  {
    title: "Add rate limiting to auth endpoints",
    description:
      "Protect login and registration from brute-force attempts with per-IP limits.",
    status: "COMPLETED",
    priority: "HIGH",
    dueInDays: -5,
    createdDaysAgo: 14,
    completedDaysAgo: 5,
  },
  {
    title: "Create database backup runbook",
    description:
      "Document restore steps, retention policy and the responsible on-call rotation.",
    status: "TODO",
    priority: "MEDIUM",
    dueInDays: 20,
    createdDaysAgo: 11,
  },
  {
    title: "Update API documentation",
    description:
      "Add the new status endpoint, pagination parameters and error code reference.",
    status: "IN_PROGRESS",
    priority: "LOW",
    dueInDays: 3,
    createdDaysAgo: 4,
  },
  {
    title: "Interview frontend candidates",
    description:
      "Prepare the take-home review rubric and two live-coding exercises.",
    status: "TODO",
    priority: "MEDIUM",
    dueInDays: 7,
    createdDaysAgo: 6,
  },
  {
    title: "Remove unused feature flags",
    description:
      "Delete flags that have been at 100% for more than two release cycles.",
    status: "TODO",
    priority: "LOW",
    dueInDays: null,
    createdDaysAgo: 25,
  },
  {
    title: "Optimise task list images",
    description:
      "Serve WebP avatars with explicit dimensions to avoid layout shift.",
    status: "COMPLETED",
    priority: "LOW",
    dueInDays: -12,
    createdDaysAgo: 28,
    completedDaysAgo: 13,
  },
  {
    title: "Prepare sprint demo",
    description:
      "Record a five-minute walkthrough of the Kanban drag-and-drop flow.",
    status: "TODO",
    priority: "HIGH",
    dueInDays: 2,
    dueHour: 15,
    createdDaysAgo: 2,
  },
  {
    title: "Fix duplicate form submissions",
    description:
      "Disable submit buttons while mutations are pending and deduplicate in-flight requests.",
    status: "COMPLETED",
    priority: "MEDIUM",
    dueInDays: -4,
    createdDaysAgo: 13,
    completedDaysAgo: 4,
  },
  {
    title: "Set up error monitoring",
    description:
      "Capture unhandled exceptions with request ids and alert on error-rate spikes.",
    status: "TODO",
    priority: "HIGH",
    dueInDays: 10,
    createdDaysAgo: 16,
  },
];

function dueDateFor(task: SeedTask, now: Date): Date | null {
  if (task.dueInDays === null) {
    return null;
  }

  const date = new Date(now.getTime() + task.dueInDays * 24 * 60 * 60 * 1000);
  date.setUTCHours(task.dueHour ?? 12, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  const now = new Date();
  const passwordHash = await hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo User" },
    create: {
      name: "Demo User",
      email: DEMO_EMAIL,
      passwordHash,
    },
  });

  const existingTasks = await prisma.task.count({ where: { userId: user.id } });
  if (existingTasks > 0) {
    console.log(
      `Seed skipped: ${existingTasks} tasks already exist for ${DEMO_EMAIL}.`,
    );
    return;
  }

  await prisma.task.createMany({
    data: seedTasks.map((task) => ({
      userId: user.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: dueDateFor(task, now),
      completedAt:
        task.status === "COMPLETED"
          ? new Date(
              now.getTime() -
                (task.completedDaysAgo ?? 0) * 24 * 60 * 60 * 1000,
            )
          : null,
      createdAt: new Date(
        now.getTime() - task.createdDaysAgo * 24 * 60 * 60 * 1000,
      ),
    })),
  });

  console.log(`Seeded ${seedTasks.length} tasks for ${DEMO_EMAIL}.`);
  console.log(`Demo credentials: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
