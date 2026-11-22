"use client";

import {
  ArrowDownWideNarrow,
  Clock,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
} from "@taskapp/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { TaskFiltersState } from "@/hooks/use-task-filters";
import { cn } from "@/lib/utils/cn";

export interface TaskFiltersProps {
  filters: TaskFiltersState;
  onChange: (patch: Partial<TaskFiltersState>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}

type SortOption =
  | "createdAt:desc"
  | "createdAt:asc"
  | "dueDate:asc"
  | "dueDate:desc"
  | "priority:desc";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "dueDate:asc", label: "Due soonest" },
  { value: "dueDate:desc", label: "Due latest" },
  { value: "priority:desc", label: "Highest priority" },
];

export function TaskFilters({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: TaskFiltersProps) {
  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (debouncedSearch !== filters.q) {
      onChange({ q: debouncedSearch });
    }
  }, [debouncedSearch, filters.q, onChange]);

  const currentSort = `${filters.sortBy}:${filters.sortOrder}` as SortOption;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks by title…"
            aria-label="Search tasks by title"
            className="pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
          <Select
            value={filters.status ?? ""}
            onChange={(event) =>
              onChange({
                status: (event.target.value || undefined) as
                  | TaskStatus
                  | undefined,
              })
            }
            aria-label="Filter by status"
            className="lg:w-40"
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>

          <Select
            value={filters.priority ?? ""}
            onChange={(event) =>
              onChange({
                priority: (event.target.value || undefined) as
                  | TaskPriority
                  | undefined,
              })
            }
            aria-label="Filter by priority"
            className="lg:w-36"
          >
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>

          <div className="relative">
            <ArrowDownWideNarrow
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Select
              value={currentSort}
              onChange={(event) => {
                const [sortBy, sortOrder] = event.target.value.split(":") as [
                  TaskSortField,
                  "asc" | "desc",
                ];
                onChange({ sortBy, sortOrder });
              }}
              aria-label="Sort tasks"
              className="pl-9 lg:w-44"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <Button
            variant={filters.overdue ? "primary" : "outline"}
            onClick={() => onChange({ overdue: !filters.overdue })}
            aria-pressed={filters.overdue}
            className={cn("justify-start lg:justify-center")}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            Overdue
          </Button>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Filters are applied to the whole workspace.
          </p>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  );
}
