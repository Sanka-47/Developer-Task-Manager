"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  DEFAULT_PAGE_SIZE,
  SORT_ORDERS,
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES,
  type SortOrder,
  type TaskPriority,
  type TaskSortField,
  type TaskStatus,
} from "@taskapp/shared";

import type { TaskListParams } from "@/lib/api/tasks.api";

export interface TaskFiltersState {
  page: number;
  pageSize: number;
  q: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  overdue: boolean;
  sortBy: TaskSortField;
  sortOrder: SortOrder;
}

const PAGE_SIZES = [10, 20, 50];

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isTaskStatus(value: string | null): value is TaskStatus {
  return value !== null && (TASK_STATUSES as readonly string[]).includes(value);
}

function isTaskPriority(value: string | null): value is TaskPriority {
  return value !== null && (TASK_PRIORITIES as readonly string[]).includes(value);
}

function isSortField(value: string | null): value is TaskSortField {
  return value !== null && (TASK_SORT_FIELDS as readonly string[]).includes(value);
}

function isSortOrder(value: string | null): value is SortOrder {
  return value !== null && (SORT_ORDERS as readonly string[]).includes(value);
}

function parseFilters(searchParams: URLSearchParams): TaskFiltersState {
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
  );

  return {
    page: parsePositiveInt(searchParams.get("page"), 1),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    q: searchParams.get("q")?.slice(0, 120) ?? "",
    status: isTaskStatus(searchParams.get("status"))
      ? (searchParams.get("status") as TaskStatus)
      : undefined,
    priority: isTaskPriority(searchParams.get("priority"))
      ? (searchParams.get("priority") as TaskPriority)
      : undefined,
    overdue: searchParams.get("overdue") === "true",
    sortBy: isSortField(searchParams.get("sortBy"))
      ? (searchParams.get("sortBy") as TaskSortField)
      : "createdAt",
    sortOrder: isSortOrder(searchParams.get("sortOrder"))
      ? (searchParams.get("sortOrder") as SortOrder)
      : "desc",
  };
}

export function toTaskListParams(filters: TaskFiltersState): TaskListParams {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    q: filters.q || undefined,
    status: filters.status,
    priority: filters.priority,
    overdue: filters.overdue || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };
}

export function useTaskFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<TaskFiltersState>) => {
      const next = new URLSearchParams(searchParams.toString());
      const changesPage = Object.prototype.hasOwnProperty.call(patch, "page");

      for (const [key, value] of Object.entries(patch)) {
        const shouldDelete =
          value === undefined ||
          value === "" ||
          value === false ||
          (key === "page" && value === 1) ||
          (key === "pageSize" && value === DEFAULT_PAGE_SIZE) ||
          (key === "sortBy" && value === "createdAt") ||
          (key === "sortOrder" && value === "desc");

        if (shouldDelete) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      if (!changesPage) {
        next.delete("page");
      }

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const hasActiveFilters =
    filters.q.length > 0 ||
    filters.status !== undefined ||
    filters.priority !== undefined ||
    filters.overdue ||
    filters.sortBy !== "createdAt" ||
    filters.sortOrder !== "desc";

  return { filters, setFilters, clearFilters, hasActiveFilters };
}
