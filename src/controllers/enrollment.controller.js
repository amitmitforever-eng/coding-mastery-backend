const { z } = require("zod");

const HttpError = require("../utils/httpError");
const EnrollmentModel = require("../models/enrollment.model");

const LEVEL_VALUES = ["Basic", "Intermediate", "Advanced"];

/* Reusable validators with friendly messages. */
const slugSchema = z
  .string({ required_error: "Course slug is required." })
  .trim()
  .min(1, "Course slug is required.")
  .max(160, "Course slug is too long.");

const enrollSchema = z.object({
  courseSlug: slugSchema,
  isFree: z.boolean().optional().default(false),
});

const purchaseSchema = z.object({
  level: z
    .enum(LEVEL_VALUES, {
      invalid_type_error: "Level must be Basic, Intermediate or Advanced.",
    })
    .optional(),
});

const progressSchema = z.object({
  progress: z
    .number({
      required_error: "Progress is required.",
      invalid_type_error: "Progress must be a number between 0 and 100.",
    })
    .min(0, "Progress must be between 0 and 100.")
    .max(100, "Progress must be between 0 and 100."),
});

function ensureUser(req) {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated");
  }
  // We allow teacher / admin to enroll too (so they can preview the user
  // experience), but the endpoint is conceptually "my enrollments" - we just
  // store one row per (user, course).
  return req.user.id;
}

async function listMine(req, res, next) {
  try {
    const userId = ensureUser(req);
    const enrollments = await EnrollmentModel.listForUser(userId);
    res.json({ enrollments });
  } catch (err) {
    next(err);
  }
}

async function enrollMine(req, res, next) {
  try {
    const userId = ensureUser(req);
    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }
    const { courseSlug, isFree } = parsed.data;
    const enrollment = await EnrollmentModel.enroll(userId, courseSlug, {
      isFree,
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
}

async function markPurchasedMine(req, res, next) {
  try {
    const userId = ensureUser(req);
    const slug = req.params.slug;
    const parsed = purchaseSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }
    const level = parsed.data.level ?? null;

    const existing = await EnrollmentModel.findOne(userId, slug);
    if (!existing) {
      await EnrollmentModel.enroll(userId, slug, { isFree: false });
    }
    const enrollment = await EnrollmentModel.markPurchased(
      userId,
      slug,
      level
    );
    res.json({ enrollment });
  } catch (err) {
    next(err);
  }
}

async function setProgressMine(req, res, next) {
  try {
    const userId = ensureUser(req);
    const slug = req.params.slug;
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }
    const enrollment = await EnrollmentModel.setProgress(
      userId,
      slug,
      parsed.data.progress
    );
    if (!enrollment) {
      throw new HttpError(404, "Enrollment not found");
    }
    res.json({ enrollment });
  } catch (err) {
    next(err);
  }
}

async function unenrollMine(req, res, next) {
  try {
    const userId = ensureUser(req);
    const slug = req.params.slug;
    const removed = await EnrollmentModel.unenroll(userId, slug);
    res.json({ removed });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMine,
  enrollMine,
  markPurchasedMine,
  setProgressMine,
  unenrollMine,
};
