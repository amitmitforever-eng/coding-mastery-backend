const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const HttpError = require("../utils/httpError");

/**
 * Where uploaded files live on disk. We use `<repo>/uploads/courses/...`
 * relative to the backend project root, served back to clients at the
 * `/uploads/courses/...` URL path (see app.js).
 */
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const COURSE_IMG_DIR = path.join(UPLOAD_ROOT, "courses");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(UPLOAD_ROOT);
ensureDir(COURSE_IMG_DIR);

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const courseImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COURSE_IMG_DIR),
  filename: (_req, file, cb) => {
    const ext =
      EXT_BY_MIME[file.mimetype] ||
      path.extname(file.originalname || "").toLowerCase() ||
      ".bin";
    const stamp = Date.now();
    const rand = crypto.randomBytes(6).toString("hex");
    cb(null, `course-${stamp}-${rand}${ext}`);
  },
});

const courseImageFileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(
      new HttpError(
        400,
        "Unsupported image type. Use JPG, PNG, WEBP, GIF or SVG."
      )
    );
  }
  cb(null, true);
};

const courseImageUpload = multer({
  storage: courseImageStorage,
  fileFilter: courseImageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB
});

/**
 * Wrap multer so its async errors (file too large / wrong type) flow into
 * the same `errorHandler` middleware as the rest of the API.
 */
function singleCourseImage(fieldName = "image") {
  return (req, res, next) => {
    courseImageUpload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image is too large. Max 5 MB."
            : `Upload failed: ${err.message}`;
        return next(new HttpError(400, msg));
      }
      return next(err);
    });
  };
}

module.exports = {
  UPLOAD_ROOT,
  COURSE_IMG_DIR,
  singleCourseImage,
};
