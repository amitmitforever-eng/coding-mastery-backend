const HttpError = require("../utils/httpError");

/**
 * Build a publicly-reachable URL for a stored upload. Uses the request
 * origin so the same backend can serve dev (localhost:5000) and prod
 * deployments without configuration changes on the frontend.
 */
function publicUrlFor(req, relPath) {
  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}${relPath}`;
}

async function uploadCourseImage(req, res, next) {
  try {
    if (!req.file) {
      throw new HttpError(400, "No image file received. Field name must be 'image'.");
    }
    const relPath = `/uploads/courses/${req.file.filename}`;
    res.status(201).json({
      url: publicUrlFor(req, relPath),
      path: relPath,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadCourseImage,
};
