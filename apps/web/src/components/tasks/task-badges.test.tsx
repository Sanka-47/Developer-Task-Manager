import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskPriorityBadge, TaskStatusBadge } from "./task-badges";

describe("task badges", () => {
  it("renders a readable status label", () => {
    render(<TaskStatusBadge status="IN_PROGRESS" />);

    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders a readable priority label", () => {
    render(<TaskPriorityBadge priority="HIGH" />);

    expect(screen.getByText("High")).toBeInTheDocument();
  });
});
