const { Router } = require("express");
const topics = require("../controllers/topic.controller");
const editRequests = require("../controllers/topicEditRequest.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

/* ---------------------------- Teacher ----------------------------- */
// "My" edit requests across all my courses.
router.get(
  "/teacher/topic-edit-requests",
  requireAuth,
  requireRole("teacher", "admin"),
  editRequests.listMyRequests
);

// Per-course-level: get current topics + my edit-request status.
router.get(
  "/teacher/courses/:id/levels/:level/topics",
  requireAuth,
  requireRole("teacher", "admin"),
  topics.getTopicsForLevel
);

// Per-course-level: save updated topics (requires approved request).
router.put(
  "/teacher/courses/:id/levels/:level/topics",
  requireAuth,
  requireRole("teacher", "admin"),
  topics.updateTopicsForLevel
);

// Per-course-level: raise a new edit-permission request.
router.post(
  "/teacher/courses/:id/levels/:level/edit-requests",
  requireAuth,
  requireRole("teacher", "admin"),
  editRequests.createMyRequest
);

/* ----------------------------- Admin ------------------------------ */
router.get(
  "/admin/topic-edit-requests",
  requireAuth,
  requireRole("admin"),
  editRequests.adminListRequests
);

router.get(
  "/admin/topic-edit-requests/:id",
  requireAuth,
  requireRole("admin"),
  editRequests.adminGetRequest
);

router.post(
  "/admin/topic-edit-requests/:id/approve",
  requireAuth,
  requireRole("admin"),
  editRequests.adminApproveRequest
);

router.post(
  "/admin/topic-edit-requests/:id/reject",
  requireAuth,
  requireRole("admin"),
  editRequests.adminRejectRequest
);

module.exports = router;
