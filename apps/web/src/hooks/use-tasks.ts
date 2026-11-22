"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateTaskInput,
  TaskDto,
  TaskStatus,
  UpdateTaskInput,
} from "@taskapp/shared";
import { TASK_STATUS_LABELS } from "@taskapp/shared";

import {
  tasksApi,
  type TaskListParams,
  type TaskListResult,
} from "@/lib/api/tasks.api";
import { queryKeys } from "@/lib/query/keys";
import { getErrorMessage } from "@/lib/utils/errors";

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => tasksApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id ?? ""),
    queryFn: () => tasksApi.get(id!),
    enabled: Boolean(id),
  });
}

function invalidateTaskViews(queryClient: QueryClient, id?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  if (id) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tasks.detail(id),
    });
  }
}

function applyStatus(task: TaskDto, status: TaskStatus): TaskDto {
  return {
    ...task,
    status,
    completedAt:
      status === "COMPLETED" ? new Date().toISOString() : null,
    isOverdue: status === "COMPLETED" ? false : task.isOverdue,
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      invalidateTaskViews(queryClient, task.id);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      tasksApi.update(id, input),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      invalidateTaskViews(queryClient, task.id);
    },
  });
}

interface StatusVariables {
  id: string;
  status: TaskStatus;
}

interface StatusContext {
  previous: Array<[readonly unknown[], unknown]>;
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: StatusVariables) =>
      tasksApi.updateStatus(id, status),
    onMutate: async ({ id, status }): Promise<StatusContext> => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = queryClient.getQueriesData({
        queryKey: queryKeys.tasks.all,
      });

      queryClient.setQueryData<TaskDto>(
        queryKeys.tasks.detail(id),
        (current) => (current ? applyStatus(current, status) : current),
      );

      queryClient.setQueriesData<TaskListResult>(
        { queryKey: queryKeys.tasks.lists },
        (current) => {
          if (!current || !Array.isArray(current.data)) {
            return current;
          }
          return {
            ...current,
            data: current.data.map((task) =>
              task.id === id ? applyStatus(task, status) : task,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(getErrorMessage(error));
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.tasks.detail(task.id), task);
      toast.success(`Moved to ${TASK_STATUS_LABELS[task.status]}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = queryClient.getQueriesData({
        queryKey: queryKeys.tasks.all,
      });

      queryClient.setQueriesData<TaskListResult>(
        { queryKey: queryKeys.tasks.lists },
        (current) => {
          if (!current || !Array.isArray(current.data)) {
            return current;
          }
          const nextTotal = Math.max(0, current.meta.total - 1);
          return {
            data: current.data.filter((task) => task.id !== id),
            meta: {
              ...current.meta,
              total: nextTotal,
              totalPages:
                nextTotal === 0
                  ? 0
                  : Math.ceil(nextTotal / current.meta.pageSize),
            },
          };
        },
      );

      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(id) });

      return { previous };
    },
    onError: (error, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(getErrorMessage(error));
    },
    onSuccess: () => {
      toast.success("Task deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
