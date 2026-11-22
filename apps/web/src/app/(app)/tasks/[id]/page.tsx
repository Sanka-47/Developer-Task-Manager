import type { Metadata } from "next";

import { TaskDetailsView } from "@/components/tasks/task-details-view";

export const metadata: Metadata = {
  title: "Task details",
};

export default function TaskDetailsPage() {
  return <TaskDetailsView />;
}
