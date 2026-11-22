import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";

export function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return format(new Date(iso), "MMM d, yyyy");
}

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return format(new Date(iso), "MMM d, yyyy, p");
}

export function formatDueDate(iso: string | null, isOverdue = false): string {
  if (!iso) {
    return "No due date";
  }

  const date = new Date(iso);

  if (isOverdue) {
    return `Overdue · ${format(date, "MMM d")}`;
  }
  if (isToday(date)) {
    return `Today · ${format(date, "p")}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow · ${format(date, "p")}`;
  }
  if (isYesterday(date)) {
    return `Yesterday · ${format(date, "p")}`;
  }

  return format(date, "MMM d, yyyy · p");
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

/** Converts an ISO string to the value expected by `datetime-local` inputs. */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

/**
 * Converts a `datetime-local` value (interpreted in the browser's local zone)
 * to an ISO-8601 string for the API.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
