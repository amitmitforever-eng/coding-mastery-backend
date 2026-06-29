const { getPool } = require("../config/db");

/** Tables cleared in dependency-safe order (children before parents). */
const RESET_TABLES = [
  "topic_edit_requests",
  "topics",
  "course_levels",
  "course_revisions",
  "enrollments",
  "courses",
  "password_reset_tokens",
  "users",
];

/**
 * Hard-delete every user (student, teacher, admin) and all dependent rows.
 * Intended for local/testing resets only.
 */
async function resetAllTestData(existingConnection = null) {
  const pool = getPool();
  const conn = existingConnection ?? (await pool.getConnection());
  const ownsConnection = !existingConnection;

  try {
    if (ownsConnection) await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    const cleared = {};
    for (const table of RESET_TABLES) {
      const [result] = await conn.query(`DELETE FROM \`${table}\``);
      cleared[table] = result.affectedRows ?? 0;
    }

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    if (ownsConnection) await conn.commit();

    return {
      tables: cleared,
      usersRemoved: cleared.users ?? 0,
    };
  } catch (err) {
    if (ownsConnection) await conn.rollback();
    throw err;
  } finally {
    if (ownsConnection) conn.release();
  }
}

module.exports = { resetAllTestData, RESET_TABLES };
