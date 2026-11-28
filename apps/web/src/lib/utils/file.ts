import {
  ATTACHMENT_CONTENT_TYPES,
  type AttachmentContentType,
} from "@taskapp/shared";

const EXTENSION_CONTENT_TYPES: Record<string, AttachmentContentType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const ATTACHMENT_ACCEPT = ATTACHMENT_CONTENT_TYPES.join(",");

export function isAllowedAttachmentType(
  contentType: string,
): contentType is AttachmentContentType {
  return (ATTACHMENT_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/**
 * Browsers sometimes report an empty MIME type (for example when a file is
 * dragged from certain desktop environments). Fall back to the extension so
 * the API still receives a value from its allow-list.
 */
export function resolveAttachmentContentType(
  fileName: string,
  browserType: string,
): AttachmentContentType | null {
  const normalizedType = browserType.trim().toLowerCase();
  if (isAllowedAttachmentType(normalizedType)) {
    return normalizedType;
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? (EXTENSION_CONTENT_TYPES[extension] ?? null) : null;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const formatted = exponent === 0 || value >= 10 ? Math.round(value) : value.toFixed(1);

  return `${formatted} ${units[exponent]}`;
}
