const { getPool } = require("../config/db");

const SAFE_COLUMNS =
  "id, name, email, contact, role, status, is_deleted, deleted_at, created_at, updated_at";

async function findByEmail(email) {
  const [rows] = await getPool().query(
    "SELECT id, name, email, password, contact, role, status, is_deleted FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await getPool().query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, contact, role, status = "active" }) {
  const [result] = await getPool().query(
    "INSERT INTO users (name, email, password, contact, role, status) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, passwordHash, contact || null, role, status]
  );
  return findById(result.insertId);
}

async function updatePassword(id, passwordHash) {
  const [result] = await getPool().query(
    "UPDATE users SET password = ? WHERE id = ?",
    [passwordHash, id]
  );
  return result.affectedRows > 0;
}

/** List teacher accounts, optionally filtered by approval status. */
async function listTeachers({ status } = {}) {
  const params = [];
  let where = "role = 'teacher'";
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  const [rows] = await getPool().query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE ${where} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

/** Tally teacher accounts by approval status (for admin dashboard badges). */
async function countTeachersByStatus() {
  const [rows] = await getPool().query(
    "SELECT status, COUNT(*) AS n FROM users WHERE role = 'teacher' GROUP BY status"
  );
  const out = { active: 0, pending: 0, rejected: 0, total: 0 };
  for (const r of rows) {
    out[r.status] = Number(r.n) || 0;
    out.total += Number(r.n) || 0;
  }
  return out;
}

/** Change a teacher's approval status. Scoped to role='teacher' for safety. */
async function updateStatus(id, status) {
  const [result] = await getPool().query(
    "UPDATE users SET status = ? WHERE id = ? AND role = 'teacher'",
    [status, id]
  );
  return result.affectedRows > 0;
}

/* ----------------------- Admin user management ------------------------- */

/**
 * Generic user list for the admin panel. Filterable by role, status and a
 * search term. By default soft-deleted users are excluded; pass
 * status='deleted' to list only soft-deleted accounts.
 */
async function listUsers({ role, status, search } = {}) {
  const where = [];
  const params = [];

  if (status === "deleted") {
    where.push("is_deleted = 1");
  } else {
    where.push("is_deleted = 0");
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
  }
  if (role) {
    where.push("role = ?");
    params.push(role);
  }
  if (search) {
    where.push("(name LIKE ? OR email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await getPool().query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE ${where.join(
      " AND "
    )} ORDER BY created_at DESC`,
    params
  );
  return rows;
}

/** Aggregate counts for the admin user dashboard. */
async function countUsers() {
  const [rows] = await getPool().query(
    `SELECT role, status, is_deleted, COUNT(*) AS n FROM users GROUP BY role, status, is_deleted`
  );
  const out = {
    total: 0,
    users: 0,
    teachers: 0,
    admins: 0,
    suspended: 0,
    deleted: 0,
  };
  for (const r of rows) {
    const n = Number(r.n) || 0;
    if (r.is_deleted) {
      out.deleted += n;
      continue;
    }
    out.total += n;
    if (r.role === "user") out.users += n;
    else if (r.role === "teacher") out.teachers += n;
    else if (r.role === "admin") out.admins += n;
    if (r.status === "suspended") out.suspended += n;
  }
  return out;
}

/** Change any user's status (active / suspended / pending / rejected). */
async function setUserStatus(id, status) {
  const [result] = await getPool().query(
    "UPDATE users SET status = ? WHERE id = ?",
    [status, id]
  );
  return result.affectedRows > 0;
}

/** Edit basic profile fields from the admin panel. */
async function updateProfile(id, { name, email, contact }) {
  const [result] = await getPool().query(
    "UPDATE users SET name = ?, email = ?, contact = ? WHERE id = ?",
    [name, email, contact ?? null, id]
  );
  return result.affectedRows > 0;
}

/** Soft delete: flag the row, never remove it (keeps history/FKs intact). */
async function softDelete(id) {
  const [result] = await getPool().query(
    "UPDATE users SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

/** Restore a previously soft-deleted account back to active. */
async function restore(id) {
  const [result] = await getPool().query(
    "UPDATE users SET is_deleted = 0, deleted_at = NULL, status = 'active' WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updatePassword,
  listTeachers,
  countTeachersByStatus,
  updateStatus,
  listUsers,
  countUsers,
  setUserStatus,
  updateProfile,
  softDelete,
  restore,
};
