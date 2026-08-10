import crypto from "crypto";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageAdapter } from "./types";

// S3-compatible object storage. Works with AWS S3 and any provider that speaks the S3 API:
// DigitalOcean Spaces, Cloudflare R2, Backblaze B2, Wasabi, MinIO (self-hosted), and Google
// Cloud Storage via its S3 interoperability mode. See CLOUD_DEPLOYMENT.md for per-provider
// env var recipes. Azure Blob Storage does not speak the S3 API — see that doc for options.
export class S3StorageAdapter implements StorageAdapter {
  readonly driver = "s3" as const;
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl?: string;
  private presignExpirySeconds: number;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION || "us-east-1";
    if (!bucket) {
      throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    }
    this.bucket = bucket;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
    this.presignExpirySeconds = process.env.S3_PRESIGN_EXPIRY_SECONDS
      ? Number(process.env.S3_PRESIGN_EXPIRY_SECONDS)
      : 3600;

    this.client = new S3Client({
      region,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined, // falls back to the default AWS credential chain (IAM role, etc.)
    });
  }

  async save(params: { buffer: Buffer; folder: string; originalFilename: string; mimetype: string }): Promise<string> {
    const filename = `${crypto.randomUUID()}${path.extname(params.originalFilename)}`;
    const key = `${params.folder}/${filename}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimetype,
      })
    );

    return key;
  }

  async resolveUrl(key: string): Promise<string> {
    // If the bucket/CDN is public, a static base URL avoids a request per resolve and never expires.
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${key}`;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: this.presignExpirySeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => {
      // already gone — nothing to clean up
    });
  }
}
