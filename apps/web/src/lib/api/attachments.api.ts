import type {
  AttachmentDownloadUrl,
  AttachmentDto,
  CreateAttachmentInput,
  CreateAttachmentResult,
} from "@taskapp/shared";

import { ApiError, apiRequest } from "./client";

function taskPath(taskId: string): string {
  return `/tasks/${encodeURIComponent(taskId)}/attachments`;
}

function attachmentPath(taskId: string, attachmentId: string): string {
  return `${taskPath(taskId)}/${encodeURIComponent(attachmentId)}`;
}

export const attachmentsApi = {
  list(taskId: string): Promise<AttachmentDto[]> {
    return apiRequest<AttachmentDto[]>(taskPath(taskId)).then(
      (response) => response.data,
    );
  },

  createUpload(
    taskId: string,
    input: CreateAttachmentInput,
  ): Promise<CreateAttachmentResult> {
    return apiRequest<CreateAttachmentResult>(taskPath(taskId), {
      method: "POST",
      body: input,
    }).then((response) => response.data);
  },

  complete(taskId: string, attachmentId: string): Promise<AttachmentDto> {
    return apiRequest<AttachmentDto>(
      `${attachmentPath(taskId, attachmentId)}/complete`,
      { method: "POST" },
    ).then((response) => response.data);
  },

  downloadUrl(
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentDownloadUrl> {
    return apiRequest<AttachmentDownloadUrl>(
      `${attachmentPath(taskId, attachmentId)}/download-url`,
    ).then((response) => response.data);
  },

  remove(taskId: string, attachmentId: string): Promise<void> {
    return apiRequest<void>(attachmentPath(taskId, attachmentId), {
      method: "DELETE",
    }).then(() => undefined);
  },
};

/**
 * Uploads directly to S3 with a pre-signed URL. `fetch` does not expose upload
 * progress, so XHR is used for this one browser-specific operation.
 */
export function uploadFileToPresignedUrl(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url, true);
    // Use the API-approved content type, not `file.type`: some browsers report
    // an empty MIME type and the pre-signed signature covers this header.
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.timeout = 5 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(
        new ApiError(
          xhr.status,
          "STORAGE_ERROR",
          "The file could not be uploaded. Please try again.",
        ),
      );
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          0,
          "NETWORK_ERROR",
          "Unable to reach file storage. Check your connection and try again.",
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(
        new ApiError(
          0,
          "NETWORK_ERROR",
          "The upload timed out. Please try again.",
        ),
      );
    };

    xhr.onabort = () => {
      reject(
        new ApiError(0, "NETWORK_ERROR", "The upload was cancelled."),
      );
    };

    xhr.send(file);
  });
}
