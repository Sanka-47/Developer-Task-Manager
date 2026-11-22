import { describe, expect, it } from "vitest";

import {
  taskFormSchema,
  toCreateTaskInput,
  toTaskFormValues,
} from "./task-form";

const validValues = {
  title: "Write the quarterly report",
  description: "Include revenue and churn numbers.",
  status: "IN_PROGRESS" as const,
  priority: "HIGH" as const,
  dueDate: "2026-06-15T10:30",
};

describe("taskFormSchema", () => {
  it("rejects a blank title", () => {
    const result = taskFormSchema.safeParse({ ...validValues, title: "   " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Title is required");
    }
  });

  it("rejects titles longer than 120 characters", () => {
    const result = taskFormSchema.safeParse({
      ...validValues,
      title: "a".repeat(121),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("120");
    }
  });

  it("rejects an invalid due date", () => {
    const result = taskFormSchema.safeParse({
      ...validValues,
      dueDate: "not-a-date",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Enter a valid due date");
    }
  });

  it("trims values and converts them into the API payload", () => {
    const parsed = taskFormSchema.parse({
      ...validValues,
      title: "  Write the quarterly report  ",
      description: "  Include revenue and churn numbers.  ",
    });

    const input = toCreateTaskInput(parsed);

    expect(input.title).toBe("Write the quarterly report");
    expect(input.description).toBe("Include revenue and churn numbers.");
    expect(input.status).toBe("IN_PROGRESS");
    expect(input.priority).toBe("HIGH");
    expect(input.dueDate).not.toBeNull();
  });

  it("sends null for empty optional fields", () => {
    const parsed = taskFormSchema.parse({
      ...validValues,
      description: "",
      dueDate: "",
    });

    const input = toCreateTaskInput(parsed);

    expect(input.description).toBeNull();
    expect(input.dueDate).toBeNull();
  });

  it("maps an existing task into form values", () => {
    const values = toTaskFormValues({
      id: "task_1",
      title: "Existing",
      description: null,
      status: "COMPLETED",
      priority: "LOW",
      dueDate: "2026-06-15T10:30:00.000Z",
      completedAt: "2026-06-16T10:30:00.000Z",
      isOverdue: false,
      createdAt: "2026-06-01T10:30:00.000Z",
      updatedAt: "2026-06-16T10:30:00.000Z",
    });

    expect(values.title).toBe("Existing");
    expect(values.description).toBe("");
    expect(values.status).toBe("COMPLETED");
    expect(values.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
