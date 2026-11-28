import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { StorageError } from "../../common/errors/app-error";
import type {
  DownloadUrlOptions,
  FileStorage,
  StoredObjectMetadata,
  UploadUrlOptions,
} from "./file-storage";

export interface S3FileStorageConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  /**
   * Endpoint used in pre-signed URLs. In Docker the API reaches LocalStack at
   * `http://localstack:4566`, while the browser must use
   * `http://localhost:4566`; signing with the browser-facing host keeps the
   * signature valid. In AWS both values are omitted.
   */
  publicEndpoint?: string;
  forcePathStyle: boolean;
}

interface S3ErrorLike {
  name?: string;
  $metadata?: { httpStatusCode?: number };
}

function isNotFound(error: unknown): boolean {
  const candidate = error as S3ErrorLike;
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

function contentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * S3 implementation of the storage port. Credentials are intentionally not
 * configured here: the SDK uses the default provider chain, which resolves to
 * the EC2 instance profile in AWS and to `AWS_ACCESS_KEY_ID` /
 * `AWS_SECRET_ACCESS_KEY` when running against LocalStack locally.
 */
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor(config: S3FileStorageConfig) {
    this.bucket = config.bucket;

    const common = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      // Newer SDK versions add a CRC32 checksum to pre-signed PUT URLs by
      // default. Browsers cannot calculate that header, so only add checksums
      // when an operation explicitly requires them.
      requestChecksumCalculation: "WHEN_REQUIRED" as const,
      responseChecksumValidation: "WHEN_REQUIRED" as const,
    };

    this.client = new S3Client({
      ...common,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });

    this.signingClient =
      config.publicEndpoint && config.publicEndpoint !== config.endpoint
        ? new S3Client({ ...common, endpoint: config.publicEndpoint })
        : this.client;
  }

  async createUploadUrl(options: UploadUrlOptions): Promise<string> {
    try {
      return await getSignedUrl(
        this.signingClient,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          ContentType: options.contentType,
        }),
        { expiresIn: options.expiresInSeconds },
      );
    } catch {
      throw new StorageError("Could not prepare the file upload. Please try again.");
    }
  }

  async createDownloadUrl(options: DownloadUrlOptions): Promise<string> {
    try {
      return await getSignedUrl(
        this.signingClient,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          ResponseContentDisposition: contentDisposition(options.fileName),
        }),
        { expiresIn: options.expiresInSeconds },
      );
    } catch {
      throw new StorageError("Could not prepare the file download. Please try again.");
    }
  }

  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        contentLength: result.ContentLength ?? null,
        contentType: result.ContentType ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw new StorageError("Could not verify the uploaded file. Please try again.");
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }
      throw new StorageError("Could not delete the file. Please try again.");
    }
  }
}
