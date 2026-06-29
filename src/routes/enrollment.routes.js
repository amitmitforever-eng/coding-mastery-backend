const { Router } = require("express");
const enrollments = require("../controllers/enrollment.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

/* All endpoints are scoped to the authenticated user ("/me"). */
router.get("/enrollments", requireAuth, enrollments.listMine);
router.post("/enrollments", requireAuth, enrollments.enrollMine);
router.post(
  "/enrollments/:slug/purchase",
  requireAuth,
  enrollments.markPurchasedMine
);
router.put(
  "/enrollments/:slug/progress",
  requireAuth,
  enrollments.setProgressMine
);
router.delete("/enrollments/:slug", requireAuth, enrollments.unenrollMine);

module.exports = router;
