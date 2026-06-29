const { Router } = require("express");
const courses = require("../controllers/course.controller");
const { validate } = require("../utils/validate");
const { normalizeCoursePayload } = require("../utils/levelsContent");
const { requireAuth, requireRole } = require("../middleware/auth");

const normalizeCourseBody = (body) => normalizeCoursePayload(body);

const router = Router();

/* ----------------------------- Public ---------------------------------- */
router.get("/courses", courses.listPublicCourses);
// Must be registered BEFORE "/courses/:slug" so it isn't read as a slug.
router.get("/courses/categories", courses.listCourseCategories);
router.get("/courses/:slug", courses.getPublicCourse);

/* ----------------------------- Teacher --------------------------------- */
router.get(
  "/teacher/courses",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.listMyCourses
);
router.post(
  "/teacher/courses",
  requireAuth,
  requireRole("teacher", "admin"),
  validate(courses.schemas.createCourseSchema, normalizeCourseBody),
  courses.createMyCourse
);
router.get(
  "/teacher/courses/:id",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.getMyCourse
);
router.put(
  "/teacher/courses/:id",
  requireAuth,
  requireRole("teacher", "admin"),
  validate(courses.schemas.updateCourseSchema, normalizeCourseBody),
  courses.updateMyCourse
);
router.post(
  "/teacher/courses/:id/submit",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.submitMyCourse
);

/* Revisions to an already-approved (live) course: never edits live data
 * directly, only proposes a change for admin approval. */
router.get(
  "/teacher/courses/:id/revision",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.getMyCourseRevision
);
router.post(
  "/teacher/courses/:id/revision",
  requireAuth,
  requireRole("teacher", "admin"),
  validate(courses.schemas.updateCourseSchema, normalizeCourseBody),
  courses.submitMyCourseRevision
);
router.delete(
  "/teacher/courses/:id/revision",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.cancelMyCourseRevision
);

router.delete(
  "/teacher/courses/:id",
  requireAuth,
  requireRole("teacher", "admin"),
  courses.deleteMyCourse
);

/* ------------------------------ Admin ---------------------------------- */
router.get(
  "/admin/courses",
  requireAuth,
  requireRole("admin"),
  courses.adminListCourses
);
router.get(
  "/admin/courses/:id",
  requireAuth,
  requireRole("admin"),
  courses.adminGetCourse
);
router.post(
  "/admin/courses/:id/approve",
  requireAuth,
  requireRole("admin"),
  courses.adminApproveCourse
);
router.post(
  "/admin/courses/:id/reject",
  requireAuth,
  requireRole("admin"),
  validate(courses.schemas.rejectSchema),
  courses.adminRejectCourse
);
router.delete(
  "/admin/courses/:id",
  requireAuth,
  requireRole("admin"),
  courses.adminDeleteCourse
);
router.patch(
  "/admin/courses/:id/settings",
  requireAuth,
  requireRole("admin"),
  validate(courses.schemas.adminCourseSettingsSchema),
  courses.adminUpdateCourseSettings
);
router.post(
  "/admin/courses/:id/publish",
  requireAuth,
  requireRole("admin"),
  courses.adminPublishCourse
);
router.post(
  "/admin/courses/:id/unpublish",
  requireAuth,
  requireRole("admin"),
  courses.adminUnpublishCourse
);

/* Admin review of teacher edits to live courses */
router.get(
  "/admin/course-revisions",
  requireAuth,
  requireRole("admin"),
  courses.adminListRevisions
);
router.get(
  "/admin/course-revisions/:id",
  requireAuth,
  requireRole("admin"),
  courses.adminGetRevision
);
router.post(
  "/admin/course-revisions/:id/approve",
  requireAuth,
  requireRole("admin"),
  validate(courses.schemas.revisionApproveSchema),
  courses.adminApproveRevision
);
router.post(
  "/admin/course-revisions/:id/reject",
  requireAuth,
  requireRole("admin"),
  validate(courses.schemas.rejectSchema),
  courses.adminRejectRevision
);

module.exports = router;
