const { getPool } = require("../config/db");
const { normalizeYoutubeUrl } = require("../utils/youtube");
const { normalizeLevelsJson } = require("../utils/levelsContent");

/**
 * Generate a URL-friendly slug. We append a 6-char suffix so duplicate
 * titles never collide on the unique index.
 */
function makeSlug(title) {
  const base = String(title || "course")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "course"}-${suffix}`;
}

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

/** Map a raw DB row into the API response shape. */
function rowToCourse(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    duration: row.duration ?? null,
    language: row.language ?? "English",
    certificate: !!row.certificate,
    imageUrl: row.image_url ?? null,
    imageGradient:
      row.image_gradient || "from-slate-700 via-slate-800 to-slate-900",
    youtubeUrl: normalizeYoutubeUrl(row.youtube_url),
    instructor: {
      name: row.instructor_name,
      title: row.instructor_title ?? null,
      bio: row.instructor_bio ?? null,
      experienceYears: row.instructor_experience_years ?? null,
      expertise: parseJson(row.instructor_expertise, []),
      usersTaught: row.instructor_users_taught ?? null,
    },
    levels: normalizeLevelsJson(parseJson(row.levels_json, {})),
    teacher: {
      id: row.teacher_id,
      name: row.teacher_name ?? null,
      email: row.teacher_email ?? null,
      status: row.teacher_status ?? null,
    },
    status: row.status,
    isPublished: !!row.is_published,
    isFeatured: !!row.is_featured,
    discountPercent:
      row.discount_percent != null ? Number(row.discount_percent) : null,
    rejectionReason: row.rejection_reason ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT c.*,
         u.name AS teacher_name,
         u.email AS teacher_email,
         u.status AS teacher_status
  FROM courses c
  LEFT JOIN users u ON u.id = c.teacher_id
`;

async function findById(id) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE c.id = ? LIMIT 1`,
    [id]
  );
  return rowToCourse(rows[0]);
}

async function findBySlug(slug) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE c.slug = ? LIMIT 1`,
    [slug]
  );
  return rowToCourse(rows[0]);
}

async function listAll({ status, search } = {}) {
  const params = [];
  const where = [];
  if (status) {
    where.push("c.status = ?");
    params.push(status);
  }
  if (search) {
    where.push("(c.title LIKE ? OR c.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await getPool().query(
    `${SELECT_BASE} ${whereSql} ORDER BY c.created_at DESC`,
    params
  );
  return rows.map(rowToCourse);
}

async function listApproved() {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE c.status = 'approved' AND c.is_published = 1 ORDER BY c.is_featured DESC, c.created_at DESC`
  );
  return rows.map(rowToCourse);
}

async function listForTeacher(teacherId) {
  const [rows] = await getPool().query(
    `${SELECT_BASE} WHERE c.teacher_id = ? ORDER BY c.created_at DESC`,
    [teacherId]
  );
  return rows.map(rowToCourse);
}

async function countsByStatus() {
  const [rows] = await getPool().query(
    "SELECT status, COUNT(*) AS count FROM courses GROUP BY status"
  );
  const out = { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const row of rows) {
    out[row.status] = Number(row.count) || 0;
    out.total += Number(row.count) || 0;
  }
  return out;
}

async function createDraft({ teacherId, status = "pending", data }) {
  const slug = makeSlug(data.title);
  const submittedAt = status === "pending" ? new Date() : null;
  const [result] = await getPool().query(
    `INSERT INTO courses (
      slug, title, description, category, difficulty, duration, language, certificate,
      image_url, image_gradient, youtube_url,
      instructor_name, instructor_title, instructor_bio, instructor_experience_years,
      instructor_expertise, instructor_users_taught,
      levels_json, teacher_id, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      data.title,
      data.description,
      data.category,
      data.difficulty,
      data.duration ?? null,
      data.language ?? "English",
      data.certificate ? 1 : 0,
      data.imageUrl ?? null,
      data.imageGradient || "from-slate-700 via-slate-800 to-slate-900",
      data.youtubeUrl ?? null,
      data.instructor.name,
      data.instructor.title ?? null,
      data.instructor.bio ?? null,
      data.instructor.experienceYears ?? null,
      JSON.stringify(data.instructor.expertise ?? []),
      data.instructor.usersTaught ?? null,
      JSON.stringify(normalizeLevelsJson(data.levels)),
      teacherId,
      status,
      submittedAt,
    ]
  );
  return findById(result.insertId);
}

async function updateById(id, data) {
  await getPool().query(
    `UPDATE courses SET
      title = ?, description = ?, category = ?, difficulty = ?,
      duration = ?, language = ?, certificate = ?,
      image_url = ?, image_gradient = ?, youtube_url = ?,
      instructor_name = ?, instructor_title = ?, instructor_bio = ?,
      instructor_experience_years = ?, instructor_expertise = ?, instructor_users_taught = ?,
      levels_json = ?
    WHERE id = ?`,
    [
      data.title,
      data.description,
      data.category,
      data.difficulty,
      data.duration ?? null,
      data.language ?? "English",
      data.certificate ? 1 : 0,
      data.imageUrl ?? null,
      data.imageGradient || "from-slate-700 via-slate-800 to-slate-900",
      data.youtubeUrl ?? null,
      data.instructor.name,
      data.instructor.title ?? null,
      data.instructor.bio ?? null,
      data.instructor.experienceYears ?? null,
      JSON.stringify(data.instructor.expertise ?? []),
      data.instructor.usersTaught ?? null,
      JSON.stringify(normalizeLevelsJson(data.levels)),
      id,
    ]
  );
  return findById(id);
}

async function setStatus(id, status, extras = {}) {
  const fields = ["status = ?"];
  const params = [status];

  if (status === "approved") {
    fields.push("approved_at = CURRENT_TIMESTAMP");
    fields.push("approved_by = ?");
    params.push(extras.approverId ?? null);
    fields.push("rejection_reason = NULL");
    fields.push("is_published = 1");
  } else if (status === "rejected") {
    fields.push("rejection_reason = ?");
    params.push(extras.reason ?? null);
    fields.push("approved_at = NULL");
    fields.push("approved_by = NULL");
  } else if (status === "pending") {
    fields.push("submitted_at = CURRENT_TIMESTAMP");
    fields.push("rejection_reason = NULL");
  }

  await getPool().query(
    `UPDATE courses SET ${fields.join(", ")} WHERE id = ?`,
    [...params, id]
  );
  return findById(id);
}

async function setPublished(id, isPublished) {
  await getPool().query(
    "UPDATE courses SET is_published = ? WHERE id = ?",
    [isPublished ? 1 : 0, id]
  );
  return findById(id);
}

/**
 * Admin-only: update title, per-level prices, discount, featured.
 * Merges level prices into existing levels_json without touching other content.
 */
async function updateAdminSettings(id, settings) {
  const existing = await findById(id);
  if (!existing) return null;

  const sets = [];
  const params = [];

  if (settings.title != null) {
    sets.push("title = ?");
    params.push(settings.title);
  }

  if (settings.levelPrices) {
    const levels = { ...existing.levels };
    for (const [level, price] of Object.entries(settings.levelPrices)) {
      if (levels[level] != null && price != null) {
        levels[level] = { ...levels[level], price: Number(price) };
      }
    }
    sets.push("levels_json = ?");
    params.push(JSON.stringify(normalizeLevelsJson(levels)));
  }

  if (settings.discountPercent !== undefined) {
    sets.push("discount_percent = ?");
    params.push(settings.discountPercent);
  }

  if (settings.isFeatured !== undefined) {
    sets.push("is_featured = ?");
    params.push(settings.isFeatured ? 1 : 0);
  }

  if (settings.isPublished !== undefined) {
    sets.push("is_published = ?");
    params.push(settings.isPublished ? 1 : 0);
  }

  if (sets.length === 0) return existing;

  await getPool().query(
    `UPDATE courses SET ${sets.join(", ")} WHERE id = ?`,
    [...params, id]
  );
  return findById(id);
}

async function deleteById(id) {
  const [result] = await getPool().query("DELETE FROM courses WHERE id = ?", [
    id,
  ]);
  return result.affectedRows > 0;
}

/**
 * Distinct, non-empty course categories currently stored in the courses
 * table. Used to populate the category dropdown when teachers create/edit a
 * course so the options mirror what already exists.
 */
async function distinctCategories() {
  const [rows] = await getPool().query(
    "SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC"
  );
  return rows.map((r) => r.category).filter(Boolean);
}

/**
 * Transfer ownership of every course from one teacher to another (used when a
 * teacher is soft-deleted: their courses are kept and handed to the admin so
 * enrollments / history stay intact). The display `instructor_name` on each
 * course is left untouched, so the original author still shows on the course.
 * Returns the number of courses moved.
 */
async function reassignTeacher(fromTeacherId, toTeacherId) {
  const [result] = await getPool().query(
    "UPDATE courses SET teacher_id = ? WHERE teacher_id = ?",
    [toTeacherId, fromTeacherId]
  );
  return result.affectedRows;
}

module.exports = {
  findById,
  findBySlug,
  listAll,
  listApproved,
  listForTeacher,
  countsByStatus,
  createDraft,
  updateById,
  setStatus,
  setPublished,
  updateAdminSettings,
  deleteById,
  reassignTeacher,
  distinctCategories,
};
