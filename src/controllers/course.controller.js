const { z } = require("zod");

const HttpError = require("../utils/httpError");
const { normalizeYoutubeUrl } = require("../utils/youtube");
const { normalizeCoursePayload } = require("../utils/levelsContent");
const CourseModel = require("../models/course.model");
const CourseRevisionModel = require("../models/courseRevision.model");

const LEVELS = ["Basic", "Intermediate", "Advanced"];

/**
 * Every constraint below ships a friendly message so the teacher never sees
 * Zod's defaults like "String must contain at least 1 character(s)" or
 * "Required". The frontend renders these messages directly under the
 * matching input.
 */

const questionAnswerItemSchema = z.object({
  question: z
    .string({ required_error: "Please enter a question." })
    .trim()
    .min(3, "Question must be at least 3 characters.")
    .max(255, "Question is too long (max 255 characters)."),
  answer: z
    .string({ required_error: "Please enter an answer." })
    .trim()
    .min(3, "Answer must be at least 3 characters.")
    .max(2000, "Answer is too long (max 2000 characters)."),
});

const moduleSchema = z.object({
  id: z.string().trim().optional(),
  title: z
    .string({ required_error: "Please enter a module title." })
    .trim()
    .min(2, "Module title must be at least 2 characters.")
    .max(255, "Module title is too long (max 255 characters)."),
  topics: z
    .array(
      z
        .string({ required_error: "Please enter a topic." })
        .trim()
        .min(1, "Topic cannot be empty.")
        .max(255, "Topic is too long (max 255 characters).")
    )
    .min(1, "Please add at least one topic to this module."),
});

const levelContentSchema = z.object({
  price: z
    .number({
      required_error: "Please enter a price (use 0 for free).",
      invalid_type_error: "Price must be a number (use 0 for free).",
    })
    .nonnegative("Price cannot be negative."),
  longDescription: z
    .string({ required_error: "Please write an overview for this level." })
    .trim()
    .min(10, "Overview must be at least 10 characters.")
    .max(5000, "Overview is too long (max 5000 characters)."),
  learningOutcomes: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Each learning outcome must be at least 2 characters.")
        .max(255, "Learning outcome is too long (max 255 characters).")
    )
    .default([]),
  prerequisites: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Prerequisite cannot be empty.")
        .max(255, "Prerequisite is too long (max 255 characters).")
    )
    .default([]),
  modules: z.array(moduleSchema).default([]),
  topicsCovered: z.array(questionAnswerItemSchema).default([]),
  interviewQuestions: z.array(questionAnswerItemSchema).default([]),
});

const instructorSchema = z.object({
  name: z
    .string({ required_error: "Please enter the instructor's display name." })
    .trim()
    .min(2, "Instructor name must be at least 2 characters.")
    .max(255, "Instructor name is too long (max 255 characters)."),
  title: z
    .string()
    .trim()
    .max(255, "Job title is too long (max 255 characters).")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .trim()
    .max(2000, "Bio is too long (max 2000 characters).")
    .optional()
    .or(z.literal("")),
  experienceYears: z
    .number({
      invalid_type_error: "Years of experience must be a number.",
    })
    .int("Years of experience must be a whole number.")
    .min(0, "Years of experience cannot be negative.")
    .max(80, "Please enter a realistic number of years (0 - 80).")
    .optional()
    .or(z.null()),
  expertise: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Each area of expertise must have at least 1 character.")
        .max(100, "Each area of expertise is too long (max 100 characters).")
    )
    .default([]),
  usersTaught: z
    .string()
    .trim()
    .max(50, "Users taught is too long (max 50 characters).")
    .optional()
    .or(z.literal("")),
});

const baseCourseSchema = z.object({
  title: z
    .string({ required_error: "Please enter a course title." })
    .trim()
    .min(3, "Course title must be at least 3 characters.")
    .max(255, "Course title is too long (max 255 characters)."),
  description: z
    .string({ required_error: "Please enter a short description." })
    .trim()
    .min(10, "Short description must be at least 10 characters.")
    .max(500, "Short description is too long (max 500 characters)."),
  category: z
    .string({ required_error: "Please enter a category." })
    .trim()
    .min(2, "Category must be at least 2 characters.")
    .max(100, "Category is too long (max 100 characters)."),
  difficulty: z.enum(LEVELS, {
    required_error: "Please choose a default level for the course card.",
    invalid_type_error: "Default level must be Basic, Intermediate, or Advanced.",
  }),
  duration: z
    .string()
    .trim()
    .max(100, "Duration is too long (max 100 characters).")
    .optional()
    .or(z.literal("")),
  language: z
    .string()
    .trim()
    .max(50, "Language is too long (max 50 characters).")
    .default("English"),
  certificate: z.boolean().default(true),
  imageUrl: z
    .string()
    .trim()
    .max(500, "Image URL is too long (max 500 characters).")
    .optional()
    .or(z.literal("")),
  imageGradient: z
    .string()
    .trim()
    .max(255, "Image gradient class is too long (max 255 characters).")
    .optional()
    .or(z.literal("")),
  youtubeUrl: z
    .string()
    .trim()
    .max(500, "YouTube URL is too long (max 500 characters).")
    .optional()
    .or(z.literal("")),
  instructor: instructorSchema,
  levels: z.object(
    {
      Basic: levelContentSchema,
      Intermediate: levelContentSchema,
      Advanced: levelContentSchema,
    },
    {
      required_error: "Please fill in content for Basic, Intermediate, and Advanced levels.",
    }
  ),
});

const createCourseSchema = baseCourseSchema.extend({
  status: z
    .enum(["draft", "pending"], {
      invalid_type_error: "Status must be either 'draft' or 'pending'.",
    })
    .default("pending"),
});

const updateCourseSchema = baseCourseSchema;

const rejectSchema = z.object({
  reason: z
    .string({ required_error: "Please write a rejection reason." })
    .trim()
    .min(5, "Rejection reason must be at least 5 characters.")
    .max(500, "Rejection reason is too long (max 500 characters)."),
});

const revisionApproveSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Note is too long (max 500 characters).")
    .optional()
    .or(z.literal("")),
});

const LEVELS_RECORD = z.object({
  Basic: z.object({ price: z.number().nonnegative() }).optional(),
  Intermediate: z.object({ price: z.number().nonnegative() }).optional(),
  Advanced: z.object({ price: z.number().nonnegative() }).optional(),
});

/** Admin-only course controls: pricing, discount, featured, publish. */
const adminCourseSettingsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Course title must be at least 3 characters.")
    .max(255, "Course title is too long (max 255 characters).")
    .optional(),
  levels: LEVELS_RECORD.optional(),
  discountPercent: z
    .number()
    .min(0, "Discount cannot be negative.")
    .max(100, "Discount cannot exceed 100%.")
    .nullable()
    .optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

function ensureInstructorBlanksAreNulls(data) {
  const normalized = normalizeCoursePayload(data);
  // Zod's .or(literal("")) keeps "" through. Convert to null/undefined for DB.
  const i = normalized.instructor;
  normalized.instructor = {
    ...i,
    title: i.title || null,
    bio: i.bio || null,
    usersTaught: i.usersTaught || null,
  };
  normalized.duration = normalized.duration || null;
  normalized.imageUrl = normalized.imageUrl || null;
  normalized.imageGradient = normalized.imageGradient || undefined;
  normalized.youtubeUrl = normalizeYoutubeUrl(normalized.youtubeUrl);
  return normalized;
}

/** Teachers cannot change course title or per-level price; keep existing values. */
function preserveTeacherLockedFields(existingCourse, data) {
  if (!existingCourse) return data;
  data.title = existingCourse.title;
  if (existingCourse.levels && data.levels) {
    for (const level of LEVELS) {
      const existingPrice = existingCourse.levels[level]?.price;
      if (existingPrice != null && data.levels[level]) {
        data.levels[level].price = existingPrice;
      }
    }
  }
  return data;
}

/* ------------------------------- Public --------------------------------- */

async function listPublicCourses(_req, res, next) {
  try {
    const courses = await CourseModel.listApproved();
    res.json({ courses });
  } catch (err) {
    next(err);
  }
}

async function listCourseCategories(_req, res, next) {
  try {
    const categories = await CourseModel.distinctCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

async function getPublicCourse(req, res, next) {
  try {
    const { slug } = req.params;
    const course = await CourseModel.findBySlug(slug);
    if (!course || course.status !== "approved" || !course.isPublished) {
      throw new HttpError(404, "Course not found");
    }
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

/* ------------------------------- Teacher -------------------------------- */

async function listMyCourses(req, res, next) {
  try {
    const courses = await CourseModel.listForTeacher(req.user.id);
    res.json({ courses });
  } catch (err) {
    next(err);
  }
}

async function getMyCourse(req, res, next) {
  try {
    const course = await CourseModel.findById(req.params.id);
    if (!course || course.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function createMyCourse(req, res, next) {
  try {
    const data = ensureInstructorBlanksAreNulls({ ...req.body });
    const course = await CourseModel.createDraft({
      teacherId: req.user.id,
      status: data.status,
      data,
    });
    res.status(201).json({ course });
  } catch (err) {
    next(err);
  }
}

async function updateMyCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing || existing.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    if (existing.status === "approved") {
      throw new HttpError(
        400,
        "Approved courses cannot be edited. Ask an admin first."
      );
    }
    const data = ensureInstructorBlanksAreNulls({ ...req.body });
    if (req.user.role === "teacher") {
      preserveTeacherLockedFields(existing, data);
    }
    const course = await CourseModel.updateById(existing.id, data);
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function submitMyCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing || existing.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    if (existing.status === "approved") {
      throw new HttpError(400, "Course is already approved");
    }
    if (existing.status === "pending") {
      return res.json({ course: existing });
    }
    const course = await CourseModel.setStatus(existing.id, "pending");
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

/* ------------------- Teacher: edits to a live course -------------------- */
/**
 * For an already-approved (live) course a teacher cannot mutate live data.
 * Instead these endpoints manage a single pending "revision" that an admin
 * must approve before it is applied to the live course.
 */

async function loadMyApprovedCourse(req) {
  const existing = await CourseModel.findById(req.params.id);
  if (!existing || existing.teacher.id !== req.user.id) {
    throw new HttpError(404, "Course not found");
  }
  if (existing.status !== "approved") {
    throw new HttpError(
      400,
      "This course is not live yet. Edit it directly and submit for review."
    );
  }
  return existing;
}

async function getMyCourseRevision(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing || existing.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    const revision = await CourseRevisionModel.findPendingForCourse(existing.id);
    res.json({ revision });
  } catch (err) {
    next(err);
  }
}

async function submitMyCourseRevision(req, res, next) {
  try {
    const course = await loadMyApprovedCourse(req);
    const data = ensureInstructorBlanksAreNulls({ ...req.body });
    if (req.user.role === "teacher") {
      preserveTeacherLockedFields(course, data);
    }
    const revision = await CourseRevisionModel.upsertPending({
      courseId: course.id,
      teacherId: req.user.id,
      data,
    });
    res.status(201).json({ revision });
  } catch (err) {
    next(err);
  }
}

async function cancelMyCourseRevision(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing || existing.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    await CourseRevisionModel.deletePendingForCourse(existing.id);
    res.json({ message: "Pending change discarded" });
  } catch (err) {
    next(err);
  }
}

async function deleteMyCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing || existing.teacher.id !== req.user.id) {
      throw new HttpError(404, "Course not found");
    }
    if (existing.status === "approved") {
      throw new HttpError(
        400,
        "Approved courses cannot be deleted. Contact an admin."
      );
    }
    await CourseModel.deleteById(existing.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------- Admin --------------------------------- */

async function adminListCourses(req, res, next) {
  try {
    const status = req.query.status || undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const courses = await CourseModel.listAll({ status, search });
    const counts = await CourseModel.countsByStatus();
    res.json({ courses, counts });
  } catch (err) {
    next(err);
  }
}

async function adminGetCourse(req, res, next) {
  try {
    const course = await CourseModel.findById(req.params.id);
    if (!course) throw new HttpError(404, "Course not found");
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function adminApproveCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");
    const course = await CourseModel.setStatus(existing.id, "approved", {
      approverId: req.user.id,
    });
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function adminRejectCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");
    const course = await CourseModel.setStatus(existing.id, "rejected", {
      reason: req.body.reason,
    });
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function adminDeleteCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");
    await CourseModel.deleteById(existing.id);
    res.json({ message: "Course deleted" });
  } catch (err) {
    next(err);
  }
}

async function adminUpdateCourseSettings(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");

    const body = req.body;
    if (body.isPublished === true && existing.status !== "approved") {
      throw new HttpError(
        400,
        "Only approved courses can be published. Approve the course first."
      );
    }

    const levelPrices = {};
    if (body.levels) {
      for (const level of LEVELS) {
        const price = body.levels[level]?.price;
        if (price != null) levelPrices[level] = price;
      }
    }

    const course = await CourseModel.updateAdminSettings(existing.id, {
      title: body.title,
      levelPrices: Object.keys(levelPrices).length ? levelPrices : undefined,
      discountPercent: body.discountPercent,
      isFeatured: body.isFeatured,
      isPublished: body.isPublished,
    });
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function adminPublishCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");
    if (existing.status !== "approved") {
      throw new HttpError(
        400,
        "Only approved courses can be published. Approve the course first."
      );
    }
    const course = await CourseModel.setPublished(existing.id, true);
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function adminUnpublishCourse(req, res, next) {
  try {
    const existing = await CourseModel.findById(req.params.id);
    if (!existing) throw new HttpError(404, "Course not found");
    const course = await CourseModel.setPublished(existing.id, false);
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

/* ---------------- Admin: review teacher course revisions ---------------- */

async function adminListRevisions(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const revisions = await CourseRevisionModel.listForAdmin({ status });
    const counts = await CourseRevisionModel.countsByStatus();
    res.json({ revisions, counts });
  } catch (err) {
    next(err);
  }
}

async function adminGetRevision(req, res, next) {
  try {
    const revision = await CourseRevisionModel.findById(req.params.id);
    if (!revision) throw new HttpError(404, "Change request not found");
    const course = await CourseModel.findById(revision.courseId);
    res.json({ revision, course });
  } catch (err) {
    next(err);
  }
}

async function adminApproveRevision(req, res, next) {
  try {
    const revision = await CourseRevisionModel.findById(req.params.id);
    if (!revision) throw new HttpError(404, "Change request not found");
    if (revision.status !== "pending") {
      throw new HttpError(400, "This change request has already been reviewed.");
    }
    const course = await CourseModel.findById(revision.courseId);
    if (!course) throw new HttpError(404, "Course no longer exists");

    // Apply the proposed snapshot to the live course, then mark approved.
    const data = ensureInstructorBlanksAreNulls({ ...revision.data });
    await CourseModel.updateById(course.id, data);
    const updated = await CourseRevisionModel.review(revision.id, {
      status: "approved",
      adminNote: req.body?.note || null,
      reviewerId: req.user.id,
    });
    const liveCourse = await CourseModel.findById(course.id);
    res.json({ revision: updated, course: liveCourse });
  } catch (err) {
    next(err);
  }
}

async function adminRejectRevision(req, res, next) {
  try {
    const revision = await CourseRevisionModel.findById(req.params.id);
    if (!revision) throw new HttpError(404, "Change request not found");
    if (revision.status !== "pending") {
      throw new HttpError(400, "This change request has already been reviewed.");
    }
    const updated = await CourseRevisionModel.review(revision.id, {
      status: "rejected",
      adminNote: req.body.reason,
      reviewerId: req.user.id,
    });
    res.json({ revision: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublicCourses,
  listCourseCategories,
  getPublicCourse,
  listMyCourses,
  getMyCourse,
  createMyCourse,
  updateMyCourse,
  submitMyCourse,
  deleteMyCourse,
  getMyCourseRevision,
  submitMyCourseRevision,
  cancelMyCourseRevision,
  adminListCourses,
  adminGetCourse,
  adminApproveCourse,
  adminRejectCourse,
  adminDeleteCourse,
  adminUpdateCourseSettings,
  adminPublishCourse,
  adminUnpublishCourse,
  adminListRevisions,
  adminGetRevision,
  adminApproveRevision,
  adminRejectRevision,
  schemas: {
    createCourseSchema,
    updateCourseSchema,
    rejectSchema,
    revisionApproveSchema,
    adminCourseSettingsSchema,
  },
};
