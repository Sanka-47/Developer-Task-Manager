import { describe, expect, it } from "vitest";

import { TaskMapper } from "./task.mapper";
import type { TaskRecord } from "./task.repository";

const task: TaskRecord = {
  id: "task_1",
  title: "Write the report",
  description: "Quarterly numbers",
  status: "IN_PROGRESS",
  priority: "HIGH",
  dueDate: new Date("2026-06-14T12:00:00.000Z"),
  completedAt: null,
  userId: "user_1",
  createdAt: new Date("2026-06-01T08:30:00.000Z"),
  updatedAt: new Date("2026-06-02T09:45:00.000Z"),
};

describe("TaskMapper", () => {
  it("serialises dates as ISO strings and derives overdue state", () => {
    const dto = TaskMapper.toDto(task, new Date("2026-06-15T12:00:00.000Z"));

    expect(dto.dueDate).toBe("2026-06-14T12:00:00.000Z");
    expect(dto.createdAt).toBe("2026-06-01T08:30:00.000Z");
    expect(dto.isOverdue).toBe(true);
  });

  it("converts ISO input into Date objects and preserves nulls", () => {
    const dto = TaskMapper.fromCreateInput({
      title: "New task",
      description: null,
      status: "TODO",
      priority: "LOW",
      dueDate: null,
    });

    expect(dto.dueDate).toBeNull();
    expect(dto.description).toBeNull();
  });

  it("distinguishes an omitted due date from an explicit clear", () => {
    expect(TaskMapper.fromUpdateInput({ title: "Renamed" })).not.toHaveProperty(
      "dueDate",
    );
    expect(TaskMapper.fromUpdateInput({ dueDate: null })).toHaveProperty(
      "dueDate",
      null,
    );
    expect(
      TaskMapper.fromUpdateInput({ dueDate: "2026-07-01T10:00:00.000Z" })
        .dueDate,
    ).toBeInstanceOf(Date);
  });
});
