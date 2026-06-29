const { getPool } = require("../config/db");

const COURSE_LEVELS = ["Basic", "Intermediate", "Advanced"];

function isCourseLevel(value) {
  return typeof value === "string" && COURSE_LEVELS.includes(value);
}

/* Random initial progress so a brand-new enrollment doesn't show 0% in the UI. */
function randomStartProgress() {
  return Math.floor(5 + Math.random() * 16);
}

function parseLevels(value) {
  if (Array.isArray(value)) {
    return value.filter(isCourseLevel);
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(isCourseLevel) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToEnrollment(row) {
  let purchasedLevels = parseLevels(row.purchased_levels);
  // Backwards compat: rows that were marked `purchased = 1` before the
  // per-level column existed unlock everything.
  if (purchasedLevels.length === 0 && row.purchased) {
    purchasedLevels = COURSE_LEVELS.slice();
  }
  return {
    id: row.id,
    userId: row.user_id,
    courseSlug: row.course_slug,
    enrolledAt: row.enrolled_at,
    purchased: purchasedLevels.length > 0,
    purchasedLevels,
    purchasedAt: row.purchased_at,
    progress: row.progress,
  };
}

async function listForUser(userId) {
  const [rows] = await getPool().query(
    `SELECT id, user_id, course_slug, enrolled_at, purchased, purchased_at,
            purchased_levels, progress
       FROM enrollments
      WHERE user_id = ?
      ORDER BY enrolled_at DESC`,
    [userId]
  );
  return rows.map(rowToEnrollment);
}

async function findOne(userId, courseSlug) {
  const [rows] = await getPool().query(
    `SELECT id, user_id, course_slug, enrolled_at, purchased, purchased_at,
            purchased_levels, progress
       FROM enrollments
      WHERE user_id = ? AND course_slug = ?
      LIMIT 1`,
    [userId, courseSlug]
  );
  return rows[0] ? rowToEnrollment(rows[0]) : null;
}

/**
 * Enroll a user in a course (idempotent).
 * - Free courses unlock every level immediately.
 * - Paid courses default to `purchased=0`, `purchased_levels=[]` (checkout
 *   pending for every level).
 */
async function enroll(userId, courseSlug, { isFree = false } = {}) {
  const existing = await findOne(userId, courseSlug);
  if (existing) return existing;

  const purchased = isFree ? 1 : 0;
  const purchasedAt = isFree ? new Date() : null;
  const purchasedLevels = isFree ? COURSE_LEVELS.slice() : [];
  await getPool().query(
    `INSERT INTO enrollments
       (user_id, course_slug, purchased, purchased_at, purchased_levels,
        progress)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      courseSlug,
      purchased,
      purchasedAt,
      JSON.stringify(purchasedLevels),
      randomStartProgress(),
    ]
  );
  return findOne(userId, courseSlug);
}

/**
 * Mark a single level (Basic / Intermediate / Advanced) as purchased.
 * If `level` is omitted (or null), unlock every level - useful for legacy
 * "buy the whole course" flows and free courses.
 */
async function markPurchased(userId, courseSlug, level = null) {
  const current = await findOne(userId, courseSlug);
  if (!current) return null;

  const next = new Set(current.purchasedLevels);
  if (level === null || level === undefined) {
    for (const l of COURSE_LEVELS) next.add(l);
  } else if (!isCourseLevel(level)) {
    return current;
  } else {
    next.add(level);
  }

  const nextLevels = COURSE_LEVELS.filter((l) => next.has(l));
  await getPool().query(
    `UPDATE enrollments
        SET purchased = 1,
            purchased_at = COALESCE(purchased_at, CURRENT_TIMESTAMP),
            purchased_levels = ?
      WHERE user_id = ? AND course_slug = ?`,
    [JSON.stringify(nextLevels), userId, courseSlug]
  );
  return findOne(userId, courseSlug);
}

async function setProgress(userId, courseSlug, progress) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  await getPool().query(
    `UPDATE enrollments
        SET progress = ?
      WHERE user_id = ? AND course_slug = ?`,
    [clamped, userId, courseSlug]
  );
  return findOne(userId, courseSlug);
}

async function unenroll(userId, courseSlug) {
  const [result] = await getPool().query(
    `DELETE FROM enrollments
      WHERE user_id = ? AND course_slug = ?`,
    [userId, courseSlug]
  );
  return result.affectedRows > 0;
}

module.exports = {
  COURSE_LEVELS,
  listForUser,
  findOne,
  enroll,
  markPurchased,
  setProgress,
  unenroll,
};
