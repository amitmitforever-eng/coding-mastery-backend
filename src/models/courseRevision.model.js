const { getPool } = require("../config/db");
const { normalizeCoursePayload } = require("../utils/levelsContent");

const STATUSES = ["pending", "approved", "rejected"];

/** Parse a JSON column that MySQL may already return decoded. */
function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToRevision(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseId: row.course_id,
    teacherId: row.teacher_id,
    status: row.status,
    data: normalizeCoursePayload(parseJson(row.data_json, {})),
    adminNote: row.admin_note ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined context (present on list/get queries).
    courseTitle: row.course_title ?? null,
    courseSlug: row.course_slug ?? null,
    courseStatus: row.course_status ?? null,
    teacherName: row.teacher_name ?? null,
    teacherEmail: row.teacher_email ?? null,
  };
}

const SELECT_BASE = `
  SELECT r.*,
         c.title  AS course_title,
         c.slug   AS course_slug,
         c.status AS course_status,
         u.name   AS teacher_name,
         u.email  AS teacher_email
    FROM course_revisions r
    JOIN courses c ON c.id = r.course_id
    JOIN users u   ON u.id = r.teacher_id
`;

async function findById(id) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rowToRevision(rows[0]);
}

/** The teacher's current pending revision for a course, if any. */
async function findPendingForCourse(courseId) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE r.course_id = ? AND r.status = 'pending'
      ORDER BY r.created_at DESC LIMIT 1`,
    [courseId]
  );
  return rowToRevision(rows[0]);
}

/**
 * Create a pending revision, or update the existing pending one (a course can
 * only have a single in-flight change at a time).
 */
async function upsertPending({ courseId, teacherId, data }) {
  const existing = await findPendingForCourse(courseId);
  if (existing) {
    await getPool().query(
      `UPDATE course_revisions
          SET data_json = ?, teacher_id = ?
        WHERE id = ?`,
      [JSON.stringify(normalizeCoursePayload(data)), teacherId, existing.id]
    );
    return findById(existing.id);
  }
  const [result] = await getPool().query(
    `INSERT INTO course_revisions (course_id, teacher_id, status, data_json)
     VALUES (?, ?, 'pending', ?)`,
    [courseId, teacherId, JSON.stringify(normalizeCoursePayload(data))]
  );
  return findById(result.insertId);
}

async function listForAdmin({ status } = {}) {
  const params = [];
  let where = "1=1";
  if (status && STATUSES.includes(status)) {
    where += " AND r.status = ?";
    params.push(status);
  }
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE ${where} ORDER BY r.created_at DESC`,
    params
  );
  return rows.map(rowToRevision);
}

async function listForTeacher(teacherId, { status } = {}) {
  const params = [teacherId];
  let where = "r.teacher_id = ?";
  if (status && STATUSES.includes(status)) {
    where += " AND r.status = ?";
    params.push(status);
  }
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE ${where} ORDER BY r.created_at DESC`,
    params
  );
  return rows.map(rowToRevision);
}

async function countsByStatus() {
  const [rows] = await getPool().query(
    "SELECT status, COUNT(*) AS n FROM course_revisions GROUP BY status"
  );
  const out = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const r of rows) {
    out[r.status] = Number(r.n) || 0;
    out.total += Number(r.n) || 0;
  }
  return out;
}

async function review(id, { status, adminNote, reviewerId }) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error(`invalid review status: ${status}`);
  }
  await getPool().query(
    `UPDATE course_revisions
        SET status = ?, admin_note = ?, reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [status, adminNote ? String(adminNote).trim() : null, reviewerId, id]
  );
  return findById(id);
}

async function deletePendingForCourse(courseId) {
  const [result] = await getPool().query(
    "DELETE FROM course_revisions WHERE course_id = ? AND status = 'pending'",
    [courseId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  STATUSES,
  findById,
  findPendingForCourse,
  upsertPending,
  listForAdmin,
  listForTeacher,
  countsByStatus,
  review,
  deletePendingForCourse,
};
