import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PaginationMeta } from "@taskapp/shared";

import { getPageItems, Pagination } from "./pagination";

const meta: PaginationMeta = {
  page: 2,
  pageSize: 10,
  total: 45,
  totalPages: 5,
  hasNextPage: true,
  hasPreviousPage: true,
};

describe("Pagination", () => {
  it("shows the visible range and triggers page changes", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <Pagination
        meta={meta}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Showing 11–20 of 45/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: "Page 4" }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("disables navigation at the edges", () => {
    render(
      <Pagination
        meta={{
          ...meta,
          page: 1,
          hasPreviousPage: false,
        }}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Page 1" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("collapses long page ranges with ellipses", () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, "ellipsis-end", 10]);
    expect(getPageItems(5, 10)).toEqual([
      1,
      "ellipsis-start",
      4,
      5,
      6,
      "ellipsis-end",
      10,
    ]);
    expect(getPageItems(1, 4)).toEqual([1, 2, 3, 4]);
  });
});
