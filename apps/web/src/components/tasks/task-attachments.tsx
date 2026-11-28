"use client";

import {
  Download,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import type { AttachmentDto } from "@taskapp/shared";
import {
  ATTACHMENT_STATUS_LABELS,
  MAX_ATTACHMENT_BYTES,
} from "@taskapp/shared";

import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
  useUploadAttachment,
} from "@/hooks/use-attachments";
import { formatDateTime } from "@/lib/utils/date";
import { getErrorMessage } from "@/lib/utils/errors";
import {
  ATTACHMENT_ACCEPT,
  formatFileSize,
} from "@/lib/utils/file";

const MAX_FILE_LABEL = `${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB`;

export function TaskAttachments({ taskId }: { taskId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);
  const download = useDownloadAttachment(taskId);

  function chooseFile(): void {
    inputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) {
      upload.mutate(file);
    }
    event.target.value = "";
  }

  const attachments = query.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Attachments
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Stored privately in S3. Images, PDF, text, CSV, ZIP and DOCX up to{" "}
            {MAX_FILE_LABEL}.
          </p>
        </div>

        <div className="shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            aria-label="Choose a file to attach"
            onChange={handleFileChange}
            disabled={upload.isPending}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={chooseFile}
            disabled={upload.isPending}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {upload.isPending ? "Uploading…" : "Add file"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {upload.isPending ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">Uploading attachment</span>
              <span className="tabular-nums text-muted-foreground" aria-live="polite">
                {upload.progress}%
              </span>
            </div>
            <Progress value={upload.progress} label="Attachment upload progress" />
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading attachments">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Couldn’t load attachments"
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
            className="py-8"
          />
        ) : attachments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Paperclip
              className="mx-auto h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium">No attachments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a reference file, screenshot or document to this task.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <AttachmentRow
                key={attachment.id}
                attachment={attachment}
                onDownload={() => download.mutate(attachment.id)}
                onDelete={() => remove.mutate(attachment.id)}
                downloadPending={download.isPending}
                deletePending={remove.isPending}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentRow({
  attachment,
  onDownload,
  onDelete,
  downloadPending,
  deletePending,
}: {
  attachment: AttachmentDto;
  onDownload: () => void;
  onDelete: () => void;
  downloadPending: boolean;
  deletePending: boolean;
}) {
  const Icon = iconFor(attachment.contentType);
  const ready = attachment.status === "UPLOADED";

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={attachment.fileName}>
          {attachment.fileName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{formatFileSize(attachment.sizeBytes)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDateTime(attachment.createdAt)}</span>
          {!ready ? (
            <>
              <span aria-hidden="true">·</span>
              <Badge
                variant={attachment.status === "FAILED" ? "danger" : "warning"}
                className="px-1.5 py-0 text-[10px]"
              >
                {ATTACHMENT_STATUS_LABELS[attachment.status]}
              </Badge>
            </>
          ) : null}
        </p>
      </div>

      {ready ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDownload}
          disabled={downloadPending}
          aria-label={`Download ${attachment.fileName}`}
          title="Download"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={deletePending}
        aria-label={`Delete ${attachment.fileName}`}
        title="Delete"
        className="text-muted-foreground hover:text-danger"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}

function iconFor(contentType: string) {
  if (contentType.startsWith("image/")) {
    return ImageIcon;
  }
  if (contentType === "application/zip") {
    return FileArchive;
  }
  return FileText;
}
