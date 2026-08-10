import { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./localAdapter";
import { S3StorageAdapter } from "./s3Adapter";

function createStorage(): StorageAdapter {
  const driver = process.env.STORAGE_DRIVER || "local";
  switch (driver) {
    case "s3":
      return new S3StorageAdapter();
    case "local":
      return new LocalStorageAdapter();
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${driver}. Expected "local" or "s3".`);
  }
}

export const storage = createStorage();
export type { StorageAdapter };
