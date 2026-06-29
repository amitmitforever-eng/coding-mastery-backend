const mysql = require("mysql2/promise");
const env = require("./env");

// Pool against the target database. Created after ensureDatabase() in initDb().
let pool;

function getPool() {
  if (!pool) {
    throw new Error("DB pool not initialized. Call initDb() first.");
  }
  return pool;
}

async function ensureDatabase() {
  // Connect without a database to CREATE DATABASE IF NOT EXISTS
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: false,
  });
  // Backtick-escape because the configured name contains a hyphen.
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

async function ensureSchema() {
  const usersSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      contact VARCHAR(20) DEFAULT NULL,
      role ENUM('user', 'teacher', 'admin') NOT NULL DEFAULT 'user',
      status ENUM('active', 'pending', 'rejected', 'suspended') NOT NULL DEFAULT 'active',
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_role (role),
      INDEX idx_users_status (status),
      INDEX idx_users_deleted (is_deleted)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  const passwordResetSql = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_prt_token (token_hash),
      INDEX idx_prt_user (user_id),
      CONSTRAINT fk_prt_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Courses owned and submitted by teachers, approved by admins. The bulky
  // per-level content (long description, outcomes, prerequisites, syllabus,
  // topics covered, interview questions, prices) is kept in `levels_json` so we don't have to
  // shard it across many tables. The shape of that JSON mirrors the
  // \`Record<CourseLevel, LevelContent>\` type the frontend already uses.
  const coursesSql = `
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(160) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      difficulty ENUM('Basic','Intermediate','Advanced') NOT NULL DEFAULT 'Basic',
      duration VARCHAR(100) DEFAULT NULL,
      language VARCHAR(50) NOT NULL DEFAULT 'English',
      certificate TINYINT(1) NOT NULL DEFAULT 1,
      image_url VARCHAR(500) DEFAULT NULL,
      image_gradient VARCHAR(255) NOT NULL DEFAULT 'from-slate-700 via-slate-800 to-slate-900',
      youtube_url VARCHAR(500) DEFAULT NULL,
      instructor_name VARCHAR(255) NOT NULL,
      instructor_title VARCHAR(255) DEFAULT NULL,
      instructor_bio TEXT,
      instructor_experience_years INT DEFAULT NULL,
      instructor_expertise JSON,
      instructor_users_taught VARCHAR(50) DEFAULT NULL,
      levels_json JSON NOT NULL,
      teacher_id INT NOT NULL,
      status ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      approved_by INT DEFAULT NULL,
      approved_at TIMESTAMP NULL DEFAULT NULL,
      submitted_at TIMESTAMP NULL DEFAULT NULL,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_courses_status (status),
      INDEX idx_courses_teacher (teacher_id),
      CONSTRAINT fk_courses_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_courses_approver
        FOREIGN KEY (approved_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Per-user enrollment + purchase state. We key by `course_slug` (not the
  // numeric course PK) so the same record can reference both static demo
  // courses (no DB row) and teacher-created/approved courses (DB row).
  //
  // `purchased = 1` is "the user has paid for at least one level". The
  // exact set of paid-for levels is in `purchased_levels` (JSON array of
  // "Basic" / "Intermediate" / "Advanced"). Free courses are inserted with
  // all three levels marked.
  const enrollmentsSql = `
    CREATE TABLE IF NOT EXISTS enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      course_slug VARCHAR(160) NOT NULL,
      enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      purchased TINYINT(1) NOT NULL DEFAULT 0,
      purchased_at TIMESTAMP NULL DEFAULT NULL,
      purchased_levels JSON DEFAULT NULL,
      progress INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_enroll_user_course (user_id, course_slug),
      INDEX idx_enroll_user (user_id),
      CONSTRAINT fk_enroll_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Normalised "Topics Covered" content. The `courses.levels_json` column
  // stays the source of truth at course-creation time and for public reads,
  // but once a course is approved teachers edit topics through these tables
  // (gated by `topic_edit_requests`). On save, the row in `topics` is the
  // authoritative store and we mirror it back into `levels_json` so the
  // existing public detail page keeps working with no changes.
  const courseLevelsSql = `
    CREATE TABLE IF NOT EXISTS course_levels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      level ENUM('Basic','Intermediate','Advanced') NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_course_level (course_id, level),
      CONSTRAINT fk_course_levels_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const topicsSql = `
    CREATE TABLE IF NOT EXISTS topics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_level_id INT NOT NULL,
      position INT NOT NULL DEFAULT 0,
      question VARCHAR(500) NOT NULL,
      answer TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_topics_level (course_level_id),
      CONSTRAINT fk_topics_level
        FOREIGN KEY (course_level_id) REFERENCES course_levels(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const topicEditRequestsSql = `
    CREATE TABLE IF NOT EXISTS topic_edit_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_level_id INT NOT NULL,
      teacher_id INT NOT NULL,
      status ENUM('pending','approved','rejected','consumed') NOT NULL DEFAULT 'pending',
      reason TEXT,
      admin_note TEXT,
      reviewed_by INT DEFAULT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      consumed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ter_level (course_level_id),
      INDEX idx_ter_teacher (teacher_id),
      INDEX idx_ter_status (status),
      CONSTRAINT fk_ter_level
        FOREIGN KEY (course_level_id) REFERENCES course_levels(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_ter_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_ter_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // Proposed edits to an already-approved (live) course. A teacher editing a
  // live course does NOT mutate it directly; instead a revision row is created
  // holding the full proposed course payload as JSON. An admin reviews it and,
  // on approval, the snapshot is applied to the live `courses` row. This keeps
  // live data unchanged until an admin signs off.
  const courseRevisionsSql = `
    CREATE TABLE IF NOT EXISTS course_revisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      teacher_id INT NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      data_json JSON NOT NULL,
      admin_note TEXT,
      reviewed_by INT DEFAULT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cr_course (course_id),
      INDEX idx_cr_teacher (teacher_id),
      INDEX idx_cr_status (status),
      CONSTRAINT fk_cr_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_cr_teacher
        FOREIGN KEY (teacher_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_cr_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await pool.query(usersSql);
  await pool.query(passwordResetSql);
  await pool.query(coursesSql);
  await pool.query(enrollmentsSql);
  await pool.query(courseLevelsSql);
  await pool.query(topicsSql);
  await pool.query(topicEditRequestsSql);
  await pool.query(courseRevisionsSql);

  // Migration: older deployments may already have the `enrollments` table
  // without the `purchased_levels` column. Try to add it and ignore the
  // "Duplicate column name" error so the boot is idempotent.
  try {
    await pool.query(
      `ALTER TABLE enrollments ADD COLUMN purchased_levels JSON DEFAULT NULL`
    );
  } catch (err) {
    ignoreDuplicateColumn(err);
  }

  // Migration: older deployments have `users` without the `status` column
  // (used to gate teacher accounts behind admin approval). Existing users
  // default to 'active' so nobody is locked out by the upgrade.
  try {
    await pool.query(
      `ALTER TABLE users
         ADD COLUMN status ENUM('active','pending','rejected')
         NOT NULL DEFAULT 'active' AFTER role`
    );
  } catch (err) {
    ignoreDuplicateColumn(err);
  }
  try {
    await pool.query(`ALTER TABLE users ADD INDEX idx_users_status (status)`);
  } catch (err) {
    ignoreDuplicateKey(err);
  }

  // Migration: allow the 'suspended' status (admin can suspend any account).
  // MODIFY COLUMN is idempotent - re-running just re-applies the same enum.
  try {
    await pool.query(
      `ALTER TABLE users
         MODIFY COLUMN status ENUM('active','pending','rejected','suspended')
         NOT NULL DEFAULT 'active'`
    );
  } catch (err) {
    // Non-fatal: if it fails the column already supports the values we need.
    console.error("[db] could not widen users.status enum:", err.message);
  }

  // Migration: soft-delete support. We NEVER hard-delete users from the admin
  // panel (that would break courses / enrollments / history via FKs). Instead
  // we flag is_deleted and keep the row.
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER status`
    );
  } catch (err) {
    ignoreDuplicateColumn(err);
  }
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_deleted`
    );
  } catch (err) {
    ignoreDuplicateColumn(err);
  }
  try {
    await pool.query(`ALTER TABLE users ADD INDEX idx_users_deleted (is_deleted)`);
  } catch (err) {
    ignoreDuplicateKey(err);
  }

  // Migration: fix legacy YouTube channel URLs stored on courses.
  try {
    const { YOUTUBE_CHANNEL_URL } = require("../utils/youtube");
    await pool.query(
      `UPDATE courses
          SET youtube_url = ?
        WHERE youtube_url IS NOT NULL
          AND (
            youtube_url LIKE '%@codemasterybyamit%'
            OR youtube_url LIKE '%@codingimprove%'
          )`,
      [YOUTUBE_CHANNEL_URL]
    );
  } catch (err) {
    console.error("[db] could not normalize course youtube_url values:", err.message);
  }

  // Migration: admin-only course controls (publish, featured, discount).
  for (const sql of [
    `ALTER TABLE courses ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 0 AFTER submitted_at`,
    `ALTER TABLE courses ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER is_published`,
    `ALTER TABLE courses ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT NULL AFTER is_featured`,
    `ALTER TABLE courses ADD INDEX idx_courses_published (is_published)`,
    `ALTER TABLE courses ADD INDEX idx_courses_featured (is_featured)`,
  ]) {
    try {
      await pool.query(sql);
    } catch (err) {
      swallowMigrationError(err);
    }
  }
  // Existing approved courses were implicitly live — mark them published.
  try {
    await pool.query(
      `UPDATE courses SET is_published = 1 WHERE status = 'approved' AND is_published = 0`
    );
  } catch (err) {
    console.error("[db] could not backfill is_published:", err.message);
  }

  // Migration: rename legacy `faq` arrays to `interviewQuestions` inside
  // levels_json (courses) and data_json (course_revisions).
  try {
    const { normalizeLevelsJson, normalizeCoursePayload } = require("../utils/levelsContent");

    function parseJson(value, fallback) {
      if (value == null) return fallback;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }

    function levelsNeedMigration(levels) {
      if (!levels || typeof levels !== "object") return false;
      return ["Basic", "Intermediate", "Advanced"].some(
        (level) => levels[level] && Object.prototype.hasOwnProperty.call(levels[level], "faq")
      );
    }

    const [courseRows] = await pool.query(`SELECT id, levels_json FROM courses`);
    for (const row of courseRows) {
      const levels = parseJson(row.levels_json, {});
      if (!levelsNeedMigration(levels)) continue;
      await pool.query(`UPDATE courses SET levels_json = ? WHERE id = ?`, [
        JSON.stringify(normalizeLevelsJson(levels)),
        row.id,
      ]);
    }

    const [revisionRows] = await pool.query(
      `SELECT id, data_json FROM course_revisions`
    );
    for (const row of revisionRows) {
      const data = parseJson(row.data_json, {});
      if (!levelsNeedMigration(data.levels)) continue;
      await pool.query(`UPDATE course_revisions SET data_json = ? WHERE id = ?`, [
        JSON.stringify(normalizeCoursePayload(data)),
        row.id,
      ]);
    }
  } catch (err) {
    console.error("[db] could not migrate faq -> interviewQuestions:", err.message);
  }
}

/** Swallow idempotent migration errors (duplicate column / index). */
function swallowMigrationError(err) {
  if (!err) return;
  const msg = String(err.message || "").toLowerCase();
  if (err.code === "ER_DUP_FIELDNAME" || err.errno === 1060) return;
  if (err.code === "ER_DUP_KEYNAME" || err.errno === 1061) return;
  if (msg.includes("duplicate column")) return;
  if (msg.includes("duplicate key")) return;
  throw err;
}

/** Swallow "duplicate column" errors so ADD COLUMN migrations stay idempotent. */
function ignoreDuplicateColumn(err) {
  if (
    err &&
    err.code !== "ER_DUP_FIELDNAME" &&
    !(typeof err.message === "string" &&
      err.message.toLowerCase().includes("duplicate"))
  ) {
    throw err;
  }
}

/** Swallow "duplicate key name" errors so ADD INDEX migrations stay idempotent. */
function ignoreDuplicateKey(err) {
  if (
    err &&
    err.code !== "ER_DUP_KEYNAME" &&
    !(typeof err.message === "string" &&
      err.message.toLowerCase().includes("duplicate key"))
  ) {
    throw err;
  }
}

function ignoreMissingFk(err) {
  if (err && err.code !== "ER_CANT_DROP_FIELD_OR_KEY") throw err;
}

function ignoreDuplicateFk(err) {
  if (err && err.code !== "ER_DUP_KEYNAME" && err.code !== "ER_FK_DUP_NAME") {
    throw err;
  }
}

async function initDb() {
  await ensureDatabase();
  pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
  });
  await ensureSchema();
  return pool;
}

module.exports = { initDb, getPool };
