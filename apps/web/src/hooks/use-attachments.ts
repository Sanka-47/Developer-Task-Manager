"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { AttachmentDto } from "@taskapp/shared";
import { MAX_ATTACHMENT_BYTES } from "@taskapp/shared";

import {
  attachmentsApi,
  uploadFileToPresignedUrl,
} from "@/lib/api/attachments.api";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { getErrorMessage } from "@/lib/utils/errors";
import { resolveAttachmentContentType } from "@/lib/utils/file";

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attachments.list(taskId ?? ""),
    queryFn: () => attachmentsApi.list(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<AttachmentDto> => {
      const contentType = resolveAttachmentContentType(file.name, file.type);

      if (!contentType) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "This file type is not supported. Choose an image, PDF, text, CSV, ZIP or DOCX file.",
        );
      }
      if (file.size <= 0) {
        throw new ApiError(400, "VALIDATION_ERROR", "The selected file is empty.");
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          `Files must be ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB or smaller.`,
        );
      }

      setProgress(0);
      const created = await attachmentsApi.createUpload(taskId, {
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      try {
        await uploadFileToPresignedUrl(
          created.uploadUrl,
          file,
          contentType,
          setProgress,
        );
        return await attachmentsApi.complete(taskId, created.attachment.id);
      } catch (error) {
        // Do not leave a PENDING row behind when the direct-to-S3 upload fails.
        await attachmentsApi
          .remove(taskId, created.attachment.id)
          .catch(() => undefined);
        throw error;
      }
    },
    onSuccess: (attachment) => {
      queryClient.setQueryData<AttachmentDto[]>(
        queryKeys.attachments.list(taskId),
        (current) => (current ? [...current, attachment] : [attachment]),
      );
      setProgress(0);
      toast.success("Attachment uploaded");
    },
    onError: (error) => {
      setProgress(0);
      toast.error(getErrorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.list(taskId),
      });
    },
  });

  return { ...mutation, progress };
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.attachments.list(taskId);

  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.remove(taskId, attachmentId),
    onMutate: async (attachmentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AttachmentDto[]>(queryKey);

      queryClient.setQueryData<AttachmentDto[]>(queryKey, (current) =>
        current?.filter((attachment) => attachment.id !== attachmentId),
      );

      return { previous };
    },
    onError: (error, _attachmentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(getErrorMessage(error));
    },
    onSuccess: () => {
      toast.success("Attachment deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDownloadAttachment(taskId: string) {
  return useMutation({
    mutationFn: (attachmentId: string) =>
      attachmentsApi.downloadUrl(taskId, attachmentId),
    onSuccess: ({ url }) => {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error(
          "Your browser blocked the download. Allow pop-ups for this site and try again.",
        );
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
