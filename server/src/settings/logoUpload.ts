import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const logosDir = path.join(__dirname, "..", "..", "uploads", "branding");
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

export const logoUpload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Logo must be a PNG, JPEG, WEBP, or SVG image"));
      return;
    }
    cb(null, true);
  },
});
