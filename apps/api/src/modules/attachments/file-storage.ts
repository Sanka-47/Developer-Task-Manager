export interface UploadUrlOptions {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface DownloadUrlOptions {
  key: string;
  fileName: string;
  expiresInSeconds: number;
}

export interface StoredObjectMetadata {
  contentLength: number | null;
  contentType: string | null;
}

/**
 * Small storage port so the attachment domain does not depend on the AWS SDK.
 * Tests use an in-memory implementation; production uses S3 (or MinIO locally).
 */
export interface FileStorage {
  createUploadUrl(options: UploadUrlOptions): Promise<string>;
  createDownloadUrl(options: DownloadUrlOptions): Promise<string>;
  headObject(key: string): Promise<StoredObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
}
