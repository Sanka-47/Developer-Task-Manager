import type { PrismaClient } from "@prisma/client";
import type { AttachmentStatus } from "@taskapp/shared";

export interface AttachmentRecord {
  id: string;
  taskId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  uploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAttachmentData {
  taskId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: AttachmentStatus;
}

export interface IAttachmentRepository {
  create(data: CreateAttachmentData): Promise<AttachmentRecord>;
  findByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<AttachmentRecord | null>;
  findManyForTask(taskId: string, userId: string): Promise<AttachmentRecord[]>;
  markUploaded(id: string): Promise<AttachmentRecord>;
  markFailed(id: string): Promise<AttachmentRecord>;
  deleteByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<number>;
  deleteByTaskId(taskId: string, userId: string): Promise<number>;
}

export class PrismaAttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: CreateAttachmentData): Promise<AttachmentRecord> {
    return this.db.attachment.create({
      data: {
        taskId: data.taskId,
        storageKey: data.storageKey,
        fileName: data.fileName,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes,
        status: data.status,
      },
    });
  }

  findByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<AttachmentRecord | null> {
    return this.db.attachment.findFirst({
      where: { id, taskId, task: { userId } },
    });
  }

  findManyForTask(
    taskId: string,
    userId: string,
  ): Promise<AttachmentRecord[]> {
    return this.db.attachment.findMany({
      where: { taskId, task: { userId } },
      orderBy: { createdAt: "asc" },
    });
  }

  markUploaded(id: string): Promise<AttachmentRecord> {
    return this.db.attachment.update({
      where: { id },
      data: { status: "UPLOADED", uploadedAt: new Date() },
    });
  }

  markFailed(id: string): Promise<AttachmentRecord> {
    return this.db.attachment.update({
      where: { id },
      data: { status: "FAILED" },
    });
  }

  async deleteByIdForUser(
    id: string,
    taskId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.db.attachment.deleteMany({
      where: { id, taskId, task: { userId } },
    });
    return result.count;
  }

  async deleteByTaskId(taskId: string, userId: string): Promise<number> {
    const result = await this.db.attachment.deleteMany({
      where: { taskId, task: { userId } },
    });
    return result.count;
  }
}
