const { Router } = require("express");
const authRoutes = require("./auth.routes");
const courseRoutes = require("./course.routes");
const enrollmentRoutes = require("./enrollment.routes");
const topicRoutes = require("./topic.routes");
const uploadRoutes = require("./upload.routes");
const adminRoutes = require("./admin.routes");
const videoRoutes = require("./video.routes");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

router.use("/auth", authRoutes);
router.use("/", courseRoutes);
router.use("/", enrollmentRoutes);
router.use("/", topicRoutes);
router.use("/", uploadRoutes);
router.use("/", adminRoutes);
router.use("/", videoRoutes);

// Examples of role-protected endpoints (extend later for courses/videos/etc.)
router.get("/admin/ping", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ message: `Hello admin ${req.user.email}` });
});

router.get(
  "/teacher/ping",
  requireAuth,
  requireRole("teacher", "admin"),
  (req, res) => {
    res.json({ message: `Hello ${req.user.role} ${req.user.email}` });
  }
);

router.get("/user/ping", requireAuth, (req, res) => {
  res.json({ message: `Hello ${req.user.role} ${req.user.email}` });
});

module.exports = router;
