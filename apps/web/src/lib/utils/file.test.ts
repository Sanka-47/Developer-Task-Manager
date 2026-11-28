import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  isAllowedAttachmentType,
  resolveAttachmentContentType,
} from "./file";

describe("file utilities", () => {
  it("formats byte sizes for attachment rows", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10 * 1024)).toBe("10 KB");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25 MB");
  });

  it("accepts only allow-listed MIME types", () => {
    expect(isAllowedAttachmentType("application/pdf")).toBe(true);
    expect(isAllowedAttachmentType("text/plain")).toBe(true);
    expect(isAllowedAttachmentType("application/x-msdownload")).toBe(false);
  });

  it("falls back to the extension when the browser omits a MIME type", () => {
    expect(resolveAttachmentContentType("notes.txt", "")).toBe("text/plain");
    expect(resolveAttachmentContentType("photo.JPEG", "")).toBe("image/jpeg");
    expect(
      resolveAttachmentContentType("contract.docx", "application/octet-stream"),
    ).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(resolveAttachmentContentType("unknown.bin", "")).toBeNull();
  });
});
