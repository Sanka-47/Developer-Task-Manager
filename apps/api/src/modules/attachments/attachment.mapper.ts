import type { AttachmentDto } from "@taskapp/shared";

import type { AttachmentRecord } from "./attachment.repository";

export class AttachmentMapper {
  static toDto(attachment: AttachmentRecord): AttachmentDto {
    return {
      id: attachment.id,
      taskId: attachment.taskId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      status: attachment.status,
      uploadedAt: attachment.uploadedAt?.toISOString() ?? null,
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
    };
  }

  static toDtoList(attachments: AttachmentRecord[]): AttachmentDto[] {
    return attachments.map((attachment) => AttachmentMapper.toDto(attachment));
  }
}
