import type { Metadata } from "next";
import { Suspense } from "react";

import { TasksView } from "@/components/tasks/tasks-view";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Tasks",
};

function TasksFallback() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[86px] w-full rounded-xl" />
      <TaskListSkeleton />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<TasksFallback />}>
      <TasksView />
    </Suspense>
  );
}
