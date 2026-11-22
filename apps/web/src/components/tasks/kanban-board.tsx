"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarClock, GripVertical, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskDto,
  type TaskStatus,
} from "@taskapp/shared";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskActions } from "./task-actions";
import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { cn } from "@/lib/utils/cn";
import { formatDueDate } from "@/lib/utils/date";

const columnAccents: Record<TaskStatus, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-sky-500",
  COMPLETED: "bg-emerald-500",
};

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

function CardBody({
  task,
  dragHandle,
}: {
  task: TaskDto;
  dragHandle?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {task.title}
        </Link>
        {dragHandle}
      </div>

      {task.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TaskPriorityBadge priority={task.priority} />
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px]",
            task.isOverdue ? "font-medium text-danger" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="h-3 w-3" aria-hidden="true" />
          {formatDueDate(task.dueDate, task.isOverdue)}
        </span>
      </div>
    </>
  );
}

function KanbanCard({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskDto;
  onEdit: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            }
          : undefined
      }
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "z-50 opacity-40",
      )}
    >
      <CardBody
        task={task}
        dragHandle={
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="touch-none cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              aria-label={`Drag ${task.title} to change status`}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            <TaskActions task={task} onEdit={onEdit} onDelete={onDelete} />
          </div>
        }
      />
    </div>
  );
}

function KanbanColumn({
  status,
  tasks,
  onEdit,
  onDelete,
  onCreate,
}: {
  status: TaskStatus;
  tasks: TaskDto[];
  onEdit: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABELS[status]} column`}
      className={cn(
        "flex min-h-[26rem] flex-col rounded-xl border border-border bg-muted/30 transition-colors",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/80 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2 w-2 rounded-full", columnAccents[status])}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={onCreate}
          aria-label={`Create a task in ${TASK_STATUS_LABELS[status]}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 p-2.5">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}

        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 p-6 text-center">
            <p className="text-xs text-muted-foreground">
              {isOver ? "Release to move here" : "Drop tasks here"}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export interface KanbanBoardProps {
  tasks: TaskDto[];
  onStatusChange: (task: TaskDto, status: TaskStatus) => void;
  onEdit: (task: TaskDto) => void;
  onDelete: (task: TaskDto) => void;
  onCreate: () => void;
}

export function KanbanBoard({
  tasks,
  onStatusChange,
  onEdit,
  onDelete,
  onCreate,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const groups: Record<TaskStatus, TaskDto[]> = {
      TODO: [],
      IN_PROGRESS: [],
      COMPLETED: [],
    };

    for (const task of tasks) {
      groups[task.status].push(task);
    }

    return groups;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent): void {
    const task = tasks.find((candidate) => candidate.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent): void {
    const task = tasks.find((candidate) => candidate.id === event.active.id);
    setActiveTask(null);

    if (!task || !event.over) {
      return;
    }

    const nextStatus = String(event.over.id);
    if (!isTaskStatus(nextStatus) || task.status === nextStatus) {
      return;
    }

    onStatusChange(task, nextStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={grouped[status]}
            onEdit={onEdit}
            onDelete={onDelete}
            onCreate={onCreate}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <Card className="w-[min(22rem,85vw)] rotate-1 p-3 shadow-xl">
            <CardBody task={activeTask} />
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
