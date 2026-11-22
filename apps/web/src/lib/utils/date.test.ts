import { describe, expect, it } from "vitest";

import {
  fromDateTimeLocalValue,
  getInitials,
  toDateTimeLocalValue,
} from "./date";

describe("date utilities", () => {
  it("round-trips a datetime-local value through ISO", () => {
    const iso = fromDateTimeLocalValue("2026-06-15T10:30");

    expect(iso).not.toBeNull();
    expect(toDateTimeLocalValue(iso)).toBe("2026-06-15T10:30");
  });

  it("treats an empty datetime-local value as null", () => {
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(toDateTimeLocalValue(null)).toBe("");
  });

  it("derives initials from one or more names", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Grace")).toBe("GR");
    expect(getInitials("  ")).toBe("?");
  });
});
