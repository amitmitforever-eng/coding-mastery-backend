const { z } = require("zod");

const HttpError = require("../utils/httpError");
const CourseModel = require("../models/course.model");
const TopicModel = require("../models/topic.model");
const TopicEditRequestModel = require("../models/topicEditRequest.model");

const LEVELS = ["Basic", "Intermediate", "Advanced"];

const createSchema = z.object({
  reason: z
    .string({ required_error: "Please add a short reason for the edit." })
    .trim()
    .min(5, "Reason must be at least 5 characters.")
    .max(1000, "Reason is too long (max 1000 characters)."),
});

const rejectSchema = z.object({
  note: z
    .string({ required_error: "Please add a short note explaining the rejection." })
    .trim()
    .min(5, "Note must be at least 5 characters.")
    .max(1000, "Note is too long (max 1000 characters)."),
});

const approveSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000, "Note is too long (max 1000 characters).")
    .optional(),
});

function ensureLevel(level) {
  if (!LEVELS.includes(level)) {
    throw new HttpError(
      400,
      "Level must be one of Basic, Intermediate, Advanced."
    );
  }
}

async function ensureOwnedApproved(req, courseId) {
  const course = await CourseModel.findById(courseId);
  if (!course) throw new HttpError(404, "Course not found");
  const isOwner = course.teacher && course.teacher.id === req.user.id;
  if (!isOwner) {
    throw new HttpError(403, "You can only edit topics for your own courses");
  }
  if (course.status !== "approved") {
    throw new HttpError(
      400,
      "Edit requests can only be raised after a course is approved."
    );
  }
  return course;
}

/* ------------------------------ Teacher ------------------------------- */

async function createMyRequest(req, res, next) {
  try {
    const course = await ensureOwnedApproved(req, req.params.id);
    const level = req.params.level;
    ensureLevel(level);

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }

    const cl = await TopicModel.seedFromLevelsJson(course.id, level);
    const active = await TopicEditRequestModel.findActiveForLevel(
      cl.id,
      req.user.id
    );
    if (active) {
      throw new HttpError(
        400,
        active.status === "pending"
          ? "You already have a pending edit request for this level."
          : "You already have an approved edit window for this level. Save your changes first."
      );
    }

    const request = await TopicEditRequestModel.create({
      courseLevelId: cl.id,
      teacherId: req.user.id,
      reason: parsed.data.reason,
    });

    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
}

async function listMyRequests(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const requests = await TopicEditRequestModel.listForTeacher(req.user.id, {
      status,
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- Admin -------------------------------- */

async function adminListRequests(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const requests = await TopicEditRequestModel.listForAdmin({ status });
    const counts = await TopicEditRequestModel.countsByStatus();
    res.json({ requests, counts });
  } catch (err) {
    next(err);
  }
}

async function adminGetRequest(req, res, next) {
  try {
    const request = await TopicEditRequestModel.findById(req.params.id);
    if (!request) throw new HttpError(404, "Request not found");
    // Also return the current topics so the admin can review what the
    // teacher is going to edit.
    const topics = await TopicModel.listTopicsByLevelId(request.courseLevelId);
    res.json({ request, topics });
  } catch (err) {
    next(err);
  }
}

async function adminApproveRequest(req, res, next) {
  try {
    const existing = await TopicEditRequestModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Request not found");
    if (existing.status !== "pending") {
      throw new HttpError(
        400,
        `Cannot approve a request that is already ${existing.status}.`
      );
    }
    const parsed = approveSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }
    const request = await TopicEditRequestModel.review(existing.id, {
      status: "approved",
      adminNote: parsed.data.note ?? null,
      reviewerId: req.user.id,
    });
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

async function adminRejectRequest(req, res, next) {
  try {
    const existing = await TopicEditRequestModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Request not found");
    if (existing.status !== "pending") {
      throw new HttpError(
        400,
        `Cannot reject a request that is already ${existing.status}.`
      );
    }
    const parsed = rejectSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }
    const request = await TopicEditRequestModel.review(existing.id, {
      status: "rejected",
      adminNote: parsed.data.note,
      reviewerId: req.user.id,
    });
    res.json({ request });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  schemas: { createSchema, rejectSchema, approveSchema },
  createMyRequest,
  listMyRequests,
  adminListRequests,
  adminGetRequest,
  adminApproveRequest,
  adminRejectRequest,
};
