const COURSE_LEVELS = ["Basic", "Intermediate", "Advanced"];

/**
 * Rename legacy `faq` arrays to `interviewQuestions` inside one level object.
 * Keeps existing interview questions when both keys are present.
 */
function normalizeLevelContent(level) {
  if (!level || typeof level !== "object") return level;
  const next = { ...level };
  if (next.faq != null) {
    if (next.interviewQuestions == null) {
      next.interviewQuestions = next.faq;
    }
    delete next.faq;
  }
  if (!Array.isArray(next.interviewQuestions)) {
    next.interviewQuestions = [];
  }
  return next;
}

/** Normalize all levels in a course levels payload / levels_json object. */
function normalizeLevelsJson(levels) {
  if (!levels || typeof levels !== "object") return {};
  const next = { ...levels };
  for (const level of COURSE_LEVELS) {
    if (next[level]) {
      next[level] = normalizeLevelContent(next[level]);
    }
  }
  return next;
}

/** Normalize a full course API payload before validation or persistence. */
function normalizeCoursePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    levels: normalizeLevelsJson(payload.levels),
  };
}

module.exports = {
  COURSE_LEVELS,
  normalizeLevelContent,
  normalizeLevelsJson,
  normalizeCoursePayload,
};
