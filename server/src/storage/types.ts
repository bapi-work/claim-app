// Pluggable storage backend for uploaded files (claim attachments, branding logo).
// A "key" is an opaque, storage-driver-specific identifier persisted in the database
// (e.g. Attachment.storagePath, AppSettings.logoKey). Callers never construct URLs
// themselves — always go through resolveUrl(key), since the meaning of a key differs
// per driver (a relative disk path for "local", an object key for "s3").
export interface StorageAdapter {
  readonly driver: "local" | "s3";
  save(params: { buffer: Buffer; folder: string; originalFilename: string; mimetype: string }): Promise<string>;
  resolveUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
