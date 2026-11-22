"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ListTodo,
  Plus,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TASK_STATUS_LABELS } from "@taskapp/shared";

import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { DistributionList } from "@/components/dashboard/distribution";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { useDashboard } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils/cn";
import {
  formatDueDate,
  formatRelative,
} from "@/lib/utils/date";
import { getErrorMessage } from "@/lib/utils/errors";

function greetingForHour(hour: number): string {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-[104px] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const query = useDashboard();
  const [createOpen, setCreateOpen] = useState(false);

  if (query.isLoading) {
    return <DashboardSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" />
        <ErrorState
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const summary = query.data;
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "there";
  const greeting = greetingForHour(new Date().getHours());

  const statusItems = [
    {
      label: TASK_STATUS_LABELS.TODO,
      count: summary.pending,
      dotClassName: "bg-slate-400",
      indicatorClassName: "bg-slate-400",
    },
    {
      label: TASK_STATUS_LABELS.IN_PROGRESS,
      count: summary.inProgress,
      dotClassName: "bg-sky-500",
      indicatorClassName: "bg-sky-500",
    },
    {
      label: TASK_STATUS_LABELS.COMPLETED,
      count: summary.completed,
      dotClassName: "bg-emerald-500",
      indicatorClassName: "bg-emerald-500",
    },
  ];

  const priorityItems = [
    {
      label: "High",
      count: summary.byPriority.HIGH,
      dotClassName: "bg-rose-500",
      indicatorClassName: "bg-rose-500",
    },
    {
      label: "Medium",
      count: summary.byPriority.MEDIUM,
      dotClassName: "bg-amber-500",
      indicatorClassName: "bg-amber-500",
    },
    {
      label: "Low",
      count: summary.byPriority.LOW,
      dotClassName: "bg-slate-400",
      indicatorClassName: "bg-slate-400",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description="Here’s how your workspace is looking today."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        }
      />

      {summary.total === 0 ? (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Your workspace is ready</h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Create your first task to start tracking progress on the
                dashboard, in the list and on the board.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create a task
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Task statistics">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total tasks"
            value={summary.total}
            icon={ListTodo}
            tone="primary"
            href="/tasks"
            hint="Everything you own"
          />
          <StatCard
            label="Pending"
            value={summary.pending}
            icon={CircleDashed}
            tone="neutral"
            href="/tasks?status=TODO"
            hint="Not started yet"
          />
          <StatCard
            label="In progress"
            value={summary.inProgress}
            icon={Clock3}
            tone="info"
            href="/tasks?status=IN_PROGRESS"
            hint="Currently moving"
          />
          <StatCard
            label="Completed"
            value={summary.completed}
            icon={CheckCircle2}
            tone="success"
            href="/tasks?status=COMPLETED"
            hint={`${summary.completionRate}% completion rate`}
          />
          <StatCard
            label="Overdue"
            value={summary.overdue}
            icon={AlertTriangle}
            tone="danger"
            href="/tasks?overdue=true"
            hint="Past the due date"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <CardTitle>Workspace overview</CardTitle>
                <CardDescription>
                  Completion and distribution across all your tasks.
                </CardDescription>
              </div>
              <TrendingUp
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {summary.completionRate}%
                </p>
                <p className="text-xs text-muted-foreground">completed</p>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {summary.completed}
                </span>{" "}
                of {summary.total} tasks done
              </p>
            </div>
            <Progress
              value={summary.completionRate}
              className="mt-3 h-2.5"
              label="Task completion"
            />

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  By status
                </h4>
                <DistributionList items={statusItems} total={summary.total} />
              </div>
              <div>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  By priority
                </h4>
                <DistributionList
                  items={priorityItems}
                  total={summary.total}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Keep these from slipping.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/tasks?overdue=true"
              className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Overdue</span>
                  <span className="block text-xs text-muted-foreground">
                    Past the due date
                  </span>
                </span>
              </span>
              <span className="text-xl font-semibold tabular-nums text-danger">
                {summary.overdue}
              </span>
            </Link>

            <Link
              href="/tasks?sortBy=dueDate&sortOrder=asc"
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Due today</span>
                  <span className="block text-xs text-muted-foreground">
                    Still open
                  </span>
                </span>
              </span>
              <span className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {summary.dueToday}
              </span>
            </Link>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CircleDashed className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Pending</span>
                  <span className="block text-xs text-muted-foreground">
                    Waiting to be started
                  </span>
                </span>
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {summary.pending}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Upcoming deadlines</CardTitle>
              <CardDescription>The next tasks with a due date.</CardDescription>
            </div>
            <Link
              href="/tasks?sortBy=dueDate&sortOrder=asc"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "shrink-0 text-muted-foreground",
              )}
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {summary.upcoming.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing scheduled. Enjoy the breathing room.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {summary.upcoming.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="block truncate text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                      <p
                        className={cn(
                          "mt-0.5 flex items-center gap-1 text-xs",
                          task.isOverdue
                            ? "font-medium text-danger"
                            : "text-muted-foreground",
                        )}
                      >
                        <CalendarClock
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {formatDueDate(task.dueDate, task.isOverdue)}
                      </p>
                    </div>
                    <TaskPriorityBadge
                      priority={task.priority}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Recently created</CardTitle>
              <CardDescription>The newest additions to your list.</CardDescription>
            </div>
            <Link
              href="/tasks"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "shrink-0 text-muted-foreground",
              )}
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {summary.recentlyCreated.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No tasks yet. Create one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {summary.recentlyCreated.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="block truncate text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Created {formatRelative(task.createdAt)}
                      </p>
                    </div>
                    <TaskStatusBadge
                      status={task.status}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
