const { getPool } = require("../config/db");

const STATUSES = ["pending", "approved", "rejected", "consumed"];

function rowToRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    courseLevelId: row.course_level_id,
    teacherId: row.teacher_id,
    status: row.status,
    reason: row.reason ?? null,
    adminNote: row.admin_note ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    courseId: row.course_id ?? null,
    level: row.level ?? null,
    courseTitle: row.course_title ?? null,
    courseSlug: row.course_slug ?? null,
    teacherName: row.teacher_name ?? null,
    teacherEmail: row.teacher_email ?? null,
  };
}

const SELECT_BASE = `
  SELECT r.*,
         cl.course_id  AS course_id,
         cl.level      AS level,
         c.title       AS course_title,
         c.slug        AS course_slug,
         u.name        AS teacher_name,
         u.email       AS teacher_email
    FROM topic_edit_requests r
    JOIN course_levels cl ON cl.id = r.course_level_id
    JOIN courses c        ON c.id = cl.course_id
    JOIN users u          ON u.id = r.teacher_id
`;

async function findById(id) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rowToRequest(rows[0]);
}

async function findActiveForLevel(courseLevelId, teacherId) {
  // Pending OR approved-but-not-yet-consumed counts as "active".
  const [rows] = await getPool().query(
    `${SELECT_BASE}
      WHERE r.course_level_id = ? AND r.teacher_id = ?
        AND r.status IN ('pending', 'approved')
      ORDER BY r.created_at DESC
      LIMIT 1`,
    [courseLevelId, teacherId]
  );
  return rowToRequest(rows[0]);
}

async function findApprovedForLevel(courseLevelId, teacherId) {
  const [rows] = await getPool().query(
    `${SELECT_BASE}
      WHERE r.course_level_id = ? AND r.teacher_id = ? AND r.status = 'approved'
      ORDER BY r.reviewed_at DESC
      LIMIT 1`,
    [courseLevelId, teacherId]
  );
  return rowToRequest(rows[0]);
}

async function listForTeacher(teacherId, { status } = {}) {
  const params = [teacherId];
  let where = `r.teacher_id = ?`;
  if (status && STATUSES.includes(status)) {
    where += ` AND r.status = ?`;
    params.push(status);
  }
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE ${where} ORDER BY r.created_at DESC`,
    params
  );
  return rows.map(rowToRequest);
}

async function listForAdmin({ status } = {}) {
  const params = [];
  let where = `1=1`;
  if (status && STATUSES.includes(status)) {
    where += ` AND r.status = ?`;
    params.push(status);
  }
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE ${where} ORDER BY r.created_at DESC`,
    params
  );
  return rows.map(rowToRequest);
}

async function countsByStatus() {
  const [rows] = await getPool().query(
    `SELECT status, COUNT(*) AS n FROM topic_edit_requests GROUP BY status`
  );
  const out = { pending: 0, approved: 0, rejected: 0, consumed: 0, total: 0 };
  for (const r of rows) {
    out[r.status] = Number(r.n) || 0;
    out.total += Number(r.n) || 0;
  }
  return out;
}

async function create({ courseLevelId, teacherId, reason }) {
  const [result] = await getPool().query(
    `INSERT INTO topic_edit_requests (course_level_id, teacher_id, reason)
     VALUES (?, ?, ?)`,
    [courseLevelId, teacherId, reason ? String(reason).trim() : null]
  );
  return findById(result.insertId);
}

async function review(id, { status, adminNote, reviewerId }) {
  if (!["approved", "rejected"].includes(status)) {
    throw new Error(`invalid review status: ${status}`);
  }
  await getPool().query(
    `UPDATE topic_edit_requests
        SET status = ?,
            admin_note = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [status, adminNote ? String(adminNote).trim() : null, reviewerId, id]
  );
  return findById(id);
}

async function consume(id) {
  await getPool().query(
    `UPDATE topic_edit_requests
        SET status = 'consumed',
            consumed_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [id]
  );
  return findById(id);
}

module.exports = {
  STATUSES,
  findById,
  findActiveForLevel,
  findApprovedForLevel,
  listForTeacher,
  listForAdmin,
  countsByStatus,
  create,
  review,
  consume,
};
