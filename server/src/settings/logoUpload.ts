import multer from "multer";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

export const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Logo must be a PNG, JPEG, WEBP, or SVG image"));
      return;
    }
    cb(null, true);
  },
});
