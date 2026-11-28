import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type {
  AttachmentDownloadUrl,
  AttachmentDto,
  CreateAttachmentResult,
} from "@taskapp/shared";

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import type { ITaskRepository } from "../tasks/task.repository";
import type { CreateAttachmentDto } from "./attachment.dto";
import { AttachmentMapper } from "./attachment.mapper";
import type {
  AttachmentRecord,
  IAttachmentRepository,
} from "./attachment.repository";
import type { FileStorage } from "./file-storage";

export interface AttachmentServiceDependencies {
  repository: IAttachmentRepository;
  storage: FileStorage;
  tasks: Pick<ITaskRepository, "findById">;
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  maxFileBytes: number;
  keyPrefix: string;
  now?: () => Date;
}

/**
 * Coordinates attachment metadata (PostgreSQL) with file bytes (S3). The API
 * never receives file contents: clients upload directly to S3 with a
 * short-lived pre-signed URL, then call `complete` so the API can verify the
 * object before exposing it for download.
 */
export class AttachmentService {
  private readonly repository: IAttachmentRepository;
  private readonly storage: FileStorage;
  private readonly tasks: Pick<ITaskRepository, "findById">;
  private readonly uploadUrlTtlSeconds: number;
  private readonly downloadUrlTtlSeconds: number;
  private readonly maxFileBytes: number;
  private readonly keyPrefix: string;
  private readonly now: () => Date;

  constructor(dependencies: AttachmentServiceDependencies) {
    this.repository = dependencies.repository;
    this.storage = dependencies.storage;
    this.tasks = dependencies.tasks;
    this.uploadUrlTtlSeconds = dependencies.uploadUrlTtlSeconds;
    this.downloadUrlTtlSeconds = dependencies.downloadUrlTtlSeconds;
    this.maxFileBytes = dependencies.maxFileBytes;
    this.keyPrefix = dependencies.keyPrefix.replace(/\/+$/, "");
    this.now = dependencies.now ?? (() => new Date());
  }

  async list(userId: string, taskId: string): Promise<AttachmentDto[]> {
    await this.requireTask(userId, taskId);
    const attachments = await this.repository.findManyForTask(taskId, userId);
    return AttachmentMapper.toDtoList(attachments);
  }

  async createUpload(
    userId: string,
    taskId: string,
    input: CreateAttachmentDto,
  ): Promise<CreateAttachmentResult> {
    await this.requireTask(userId, taskId);

    if (input.sizeBytes > this.maxFileBytes) {
      throw new ValidationError("File is larger than the configured limit");
    }

    const fileName = sanitizeFileName(input.fileName);
    const storageKey = this.buildStorageKey(userId, taskId, fileName);
    const attachment = await this.repository.create({
      taskId,
      storageKey,
      fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: "PENDING",
    });

    try {
      const uploadUrl = await this.storage.createUploadUrl({
        key: storageKey,
        contentType: input.contentType,
        expiresInSeconds: this.uploadUrlTtlSeconds,
      });

      return {
        attachment: AttachmentMapper.toDto(attachment),
        uploadUrl,
        expiresAt: this.expiry(this.uploadUrlTtlSeconds),
      };
    } catch (error) {
      await this.repository.markFailed(attachment.id).catch(() => undefined);
      throw error;
    }
  }

  async complete(
    userId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentDto> {
    const attachment = await this.requireAttachment(userId, taskId, attachmentId);

    if (attachment.status === "UPLOADED") {
      return AttachmentMapper.toDto(attachment);
    }

    if (attachment.status === "FAILED") {
      throw new ConflictError(
        "This upload failed. Please remove it and start a new upload.",
      );
    }

    const stored = await this.storage.headObject(attachment.storageKey);

    if (!stored) {
      await this.repository.markFailed(attachment.id);
      throw new ConflictError(
        "The file was not found in storage. Please upload it again.",
      );
    }

    const storedContentType = stored.contentType
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (
      stored.contentLength !== null &&
      stored.contentLength !== attachment.sizeBytes
    ) {
      await this.failUpload(attachment);
      throw new ValidationError(
        "The uploaded file size does not match the declared size",
      );
    }

    if (storedContentType && storedContentType !== attachment.contentType) {
      await this.failUpload(attachment);
      throw new ValidationError(
        "The uploaded file type does not match the declared type",
      );
    }

    const updated = await this.repository.markUploaded(attachment.id);
    return AttachmentMapper.toDto(updated);
  }

  async createDownloadUrl(
    userId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentDownloadUrl> {
    const attachment = await this.requireAttachment(userId, taskId, attachmentId);

    if (attachment.status !== "UPLOADED") {
      throw new ConflictError("This attachment is not ready for download");
    }

    const url = await this.storage.createDownloadUrl({
      key: attachment.storageKey,
      fileName: attachment.fileName,
      expiresInSeconds: this.downloadUrlTtlSeconds,
    });

    return {
      url,
      expiresAt: this.expiry(this.downloadUrlTtlSeconds),
    };
  }

  async delete(
    userId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<void> {
    const attachment = await this.requireAttachment(userId, taskId, attachmentId);

    await this.storage.deleteObject(attachment.storageKey);
    const deleted = await this.repository.deleteByIdForUser(
      attachment.id,
      taskId,
      userId,
    );

    if (deleted === 0) {
      throw new NotFoundError("Attachment not found");
    }
  }

  /**
   * Called before a task is deleted. Removing the bytes first means a failed
   * S3 request leaves the task and its metadata intact so the operation can be
   * retried; deleting the database row first would orphan the object.
   */
  async deleteAllForTask(userId: string, taskId: string): Promise<void> {
    const attachments = await this.repository.findManyForTask(taskId, userId);

    for (const attachment of attachments) {
      await this.storage.deleteObject(attachment.storageKey);
    }

    await this.repository.deleteByTaskId(taskId, userId);
  }

  private async failUpload(attachment: AttachmentRecord): Promise<void> {
    await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
    await this.repository.markFailed(attachment.id);
  }

  private async requireTask(userId: string, taskId: string): Promise<void> {
    const task = await this.tasks.findById(userId, taskId);
    if (!task) {
      throw new NotFoundError("Task not found");
    }
  }

  private async requireAttachment(
    userId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentRecord> {
    const attachment = await this.repository.findByIdForUser(
      attachmentId,
      taskId,
      userId,
    );

    if (!attachment) {
      throw new NotFoundError("Attachment not found");
    }

    return attachment;
  }

  private buildStorageKey(
    userId: string,
    taskId: string,
    fileName: string,
  ): string {
    return `${this.keyPrefix}/${userId}/${taskId}/${randomUUID()}${extensionFor(fileName)}`;
  }

  private expiry(ttlSeconds: number): string {
    return new Date(this.now().getTime() + ttlSeconds * 1000).toISOString();
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);

  return sanitized || "file";
}

function extensionFor(fileName: string): string {
  const extension = extname(fileName)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 10);

  return extension && extension !== "." ? extension : "";
}
