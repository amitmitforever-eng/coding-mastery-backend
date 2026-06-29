const { Router } = require("express");
const uploads = require("../controllers/upload.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { singleCourseImage } = require("../middleware/upload");

const router = Router();

/**
 * POST /api/uploads/course-image
 * multipart/form-data with a single file field named "image".
 * Returns { url, path, filename, size, mimetype }.
 *
 * Only teachers and admins can upload (so we don't accidentally let
 * unauthenticated users fill our disk).
 */
router.post(
  "/uploads/course-image",
  requireAuth,
  requireRole("teacher", "admin"),
  singleCourseImage("image"),
  uploads.uploadCourseImage
);

module.exports = router;
