-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('PENDING', 'UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "attachment_status" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_task_id_created_at_idx" ON "attachments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_status_idx" ON "attachments"("status");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
