const { z } = require("zod");

const HttpError = require("../utils/httpError");
const CourseModel = require("../models/course.model");
const TopicModel = require("../models/topic.model");
const TopicEditRequestModel = require("../models/topicEditRequest.model");

const LEVELS = ["Basic", "Intermediate", "Advanced"];

const topicItemSchema = z.object({
  question: z
    .string({ required_error: "Please enter a question." })
    .trim()
    .min(3, "Question must be at least 3 characters.")
    .max(500, "Question is too long (max 500 characters)."),
  answer: z
    .string({ required_error: "Please enter an answer." })
    .trim()
    .min(3, "Answer must be at least 3 characters.")
    .max(5000, "Answer is too long (max 5000 characters)."),
});

const updateTopicsSchema = z.object({
  topics: z
    .array(topicItemSchema, {
      required_error: "Topics list is required.",
    })
    .min(1, "Add at least one topic before saving.")
    .max(50, "You can have at most 50 topics per level."),
});

function ensureLevel(value) {
  if (!LEVELS.includes(value)) {
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
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new HttpError(403, "You can only manage topics for your own courses");
  }
  if (course.status !== "approved") {
    throw new HttpError(
      400,
      "Topics can only be managed after the course is approved by an admin."
    );
  }
  return course;
}

/**
 * Teacher: GET /api/teacher/courses/:id/levels/:level/topics
 * Returns the current topics + the active edit-request status so the
 * frontend can render the right UI (request access / pending / editor).
 */
async function getTopicsForLevel(req, res, next) {
  try {
    const course = await ensureOwnedApproved(req, req.params.id);
    const level = req.params.level;
    ensureLevel(level);

    const cl = await TopicModel.seedFromLevelsJson(course.id, level);
    const topics = await TopicModel.listTopicsByLevelId(cl.id);
    const activeRequest = await TopicEditRequestModel.findActiveForLevel(
      cl.id,
      req.user.id
    );

    res.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        status: course.status,
      },
      level,
      courseLevelId: cl.id,
      topics,
      activeRequest,
      canEdit:
        Boolean(activeRequest && activeRequest.status === "approved") ||
        req.user.role === "admin",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Teacher: PUT /api/teacher/courses/:id/levels/:level/topics
 * Body: { topics: [{ question, answer }, ...] }
 * Requires an approved-and-not-yet-consumed edit request for this level.
 * Admins may save without a request.
 */
async function updateTopicsForLevel(req, res, next) {
  try {
    const course = await ensureOwnedApproved(req, req.params.id);
    const level = req.params.level;
    ensureLevel(level);

    const parsed = updateTopicsSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new HttpError(400, "Validation failed", details);
    }

    const cl = await TopicModel.ensureCourseLevel(course.id, level);

    let approvedRequest = null;
    if (req.user.role !== "admin") {
      approvedRequest = await TopicEditRequestModel.findApprovedForLevel(
        cl.id,
        req.user.id
      );
      if (!approvedRequest) {
        throw new HttpError(
          403,
          "You don't have an approved edit request for this level. Please request edit access first."
        );
      }
    }

    const saved = await TopicModel.saveTopicsAndMirror(
      course.id,
      level,
      parsed.data.topics
    );

    if (approvedRequest) {
      await TopicEditRequestModel.consume(approvedRequest.id);
    }

    res.json({
      level,
      courseLevelId: cl.id,
      topics: saved,
      consumed: Boolean(approvedRequest),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  schemas: { updateTopicsSchema },
  getTopicsForLevel,
  updateTopicsForLevel,
};
