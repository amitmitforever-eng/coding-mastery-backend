const { Router } = require("express");
const admin = require("../controllers/admin.controller");
const { validate } = require("../utils/validate");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

// Every route here is admin-only.
const adminOnly = [requireAuth, requireRole("admin")];

/* --------------------------- Teacher accounts -------------------------- */
router.get("/admin/teachers", ...adminOnly, admin.listTeachers);
router.post("/admin/teachers/:id/approve", ...adminOnly, admin.approveTeacher);
router.post("/admin/teachers/:id/reject", ...adminOnly, admin.rejectTeacher);

/* ----------------------- Unified user management ----------------------- */
router.get("/admin/users", ...adminOnly, admin.listUsers);
router.get("/admin/users/:id", ...adminOnly, admin.getUser);
router.put(
  "/admin/users/:id",
  ...adminOnly,
  validate(admin.schemas.updateUserSchema),
  admin.updateUser
);
router.post("/admin/users/:id/suspend", ...adminOnly, admin.suspendUser);
router.post("/admin/users/:id/activate", ...adminOnly, admin.activateUser);
router.post("/admin/users/:id/delete", ...adminOnly, admin.deleteUser);
router.post("/admin/users/:id/restore", ...adminOnly, admin.restoreUser);

/* ------------------------ Dev / testing utilities ---------------------- */
router.post(
  "/admin/reset-test-data",
  ...adminOnly,
  validate(admin.schemas.resetTestDataSchema),
  admin.resetTestData
);

module.exports = router;
