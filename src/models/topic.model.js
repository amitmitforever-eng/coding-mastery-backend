const { getPool } = require("../config/db");

const COURSE_LEVELS = ["Basic", "Intermediate", "Advanced"];

function isCourseLevel(value) {
  return typeof value === "string" && COURSE_LEVELS.includes(value);
}

/** Parse a JSON column whether the driver returns a string or an object. */
function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/*  course_levels                                                              */
/* -------------------------------------------------------------------------- */

async function findCourseLevel(courseId, level, conn) {
  const exec = conn || getPool();
  const [rows] = await exec.query(
    `SELECT id, course_id, level FROM course_levels
      WHERE course_id = ? AND level = ? LIMIT 1`,
    [courseId, level]
  );
  return rows[0] || null;
}

async function ensureCourseLevel(courseId, level, conn) {
  const exec = conn || getPool();
  if (!isCourseLevel(level)) throw new Error(`invalid level: ${level}`);
  const existing = await findCourseLevel(courseId, level, exec);
  if (existing) return existing;
  await exec.query(
    `INSERT INTO course_levels (course_id, level) VALUES (?, ?)`,
    [courseId, level]
  );
  return findCourseLevel(courseId, level, exec);
}

/* -------------------------------------------------------------------------- */
/*  topics                                                                    */
/* -------------------------------------------------------------------------- */

function rowToTopic(row) {
  return {
    id: row.id,
    courseLevelId: row.course_level_id,
    position: row.position,
    question: row.question,
    answer: row.answer,
  };
}

async function listTopicsByLevelId(courseLevelId, conn) {
  const exec = conn || getPool();
  const [rows] = await exec.query(
    `SELECT id, course_level_id, position, question, answer
       FROM topics
      WHERE course_level_id = ?
      ORDER BY position ASC, id ASC`,
    [courseLevelId]
  );
  return rows.map(rowToTopic);
}

/**
 * Atomically replace all topics under a course-level with the given list.
 * Each item must have `{ question, answer }`. Position is assigned by index.
 */
async function replaceTopics(courseLevelId, topics, conn) {
  const exec = conn || getPool();
  await exec.query(`DELETE FROM topics WHERE course_level_id = ?`, [
    courseLevelId,
  ]);
  if (!Array.isArray(topics) || topics.length === 0) return [];
  const values = [];
  const placeholders = [];
  topics.forEach((t, i) => {
    placeholders.push("(?, ?, ?, ?)");
    values.push(
      courseLevelId,
      i,
      String(t.question || "").trim(),
      String(t.answer || "").trim()
    );
  });
  await exec.query(
    `INSERT INTO topics (course_level_id, position, question, answer)
     VALUES ${placeholders.join(", ")}`,
    values
  );
  return listTopicsByLevelId(courseLevelId, exec);
}

/* -------------------------------------------------------------------------- */
/*  Sync helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Lazily seed `course_levels` + `topics` from `courses.levels_json` for one
 * level. Idempotent: safe to call repeatedly. Returns the `course_levels`
 * row.
 */
async function seedFromLevelsJson(courseId, level) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, levels_json FROM courses WHERE id = ? LIMIT 1`,
      [courseId]
    );
    const courseRow = rows[0];
    if (!courseRow) throw new Error(`Course ${courseId} not found`);
    const cl = await ensureCourseLevel(courseRow.id, level, conn);
    const existing = await listTopicsByLevelId(cl.id, conn);
    if (existing.length === 0) {
      const levels = parseJson(courseRow.levels_json, {});
      const items = Array.isArray(levels?.[level]?.topicsCovered)
        ? levels[level].topicsCovered
        : [];
      if (items.length > 0) {
        await replaceTopics(cl.id, items, conn);
      }
    }
    await conn.commit();
    return cl;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Save the new topics list and mirror the change back into
 * `courses.levels_json` so the public detail page (which still reads
 * levels_json) stays in sync. Wrapped in a single transaction with row-level
 * locking on the courses row.
 */
async function saveTopicsAndMirror(courseId, level, topics) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, levels_json FROM courses WHERE id = ? FOR UPDATE`,
      [courseId]
    );
    const courseRow = rows[0];
    if (!courseRow) throw new Error(`Course ${courseId} not found`);
    const cl = await ensureCourseLevel(courseRow.id, level, conn);
    const saved = await replaceTopics(cl.id, topics, conn);

    const levels = parseJson(courseRow.levels_json, {});
    const levelContent = levels[level] || {};
    levels[level] = {
      ...levelContent,
      topicsCovered: saved.map((t) => ({
        question: t.question,
        answer: t.answer,
      })),
    };
    await conn.query(
      `UPDATE courses SET levels_json = ? WHERE id = ?`,
      [JSON.stringify(levels), courseRow.id]
    );

    await conn.commit();
    return saved;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  COURSE_LEVELS,
  isCourseLevel,
  findCourseLevel,
  ensureCourseLevel,
  listTopicsByLevelId,
  replaceTopics,
  seedFromLevelsJson,
  saveTopicsAndMirror,
};
