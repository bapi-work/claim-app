import multer from "multer";

// Buffered in memory, then handed to the configured storage adapter (local disk or S3-compatible
// cloud storage) by the route handler — see src/storage/index.ts.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
