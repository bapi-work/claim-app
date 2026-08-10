import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StorageAdapter } from "./types";

const uploadsRoot = path.join(__dirname, "..", "..", "uploads");

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;

  async save(params: { buffer: Buffer; folder: string; originalFilename: string; mimetype: string }): Promise<string> {
    const dir = path.join(uploadsRoot, params.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${crypto.randomUUID()}${path.extname(params.originalFilename)}`;
    const key = `${params.folder}/${filename}`;
    fs.writeFileSync(path.join(uploadsRoot, key), params.buffer);
    return key;
  }

  async resolveUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(uploadsRoot, key);
    fs.promises.unlink(filePath).catch(() => {
      // already gone — nothing to clean up
    });
  }
}
