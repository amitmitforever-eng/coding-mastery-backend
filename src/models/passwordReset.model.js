const crypto = require("crypto");
const { getPool } = require("../config/db");

const TOKEN_TTL_MINUTES = 30;
const TOKEN_BYTES = 32;

function generateRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issue a new password reset token for a user.
 *
 * - Random 32-byte token (64 hex chars).
 * - Only the SHA-256 hash is persisted, so a DB read can't leak active tokens.
 * - Any previously unused token for the same user is invalidated.
 *
 * Returns `{ rawToken, expiresInMinutes }`. The `rawToken` is what we send
 * to the user (in the email link); the DB stores its hash.
 */
async function createForUser(userId) {
  const pool = getPool();
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  await pool.query(
    "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL",
    [userId]
  );

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, tokenHash, TOKEN_TTL_MINUTES]
  );

  return { rawToken, expiresInMinutes: TOKEN_TTL_MINUTES };
}

/**
 * Look up a token by its raw value. Returns the row when it exists, hasn't
 * been used, and hasn't expired. Otherwise returns null.
 */
async function findValidByToken(rawToken) {
  const pool = getPool();
  const tokenHash = hashToken(rawToken);
  const [rows] = await pool.query(
    `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
      WHERE token_hash = ?
      LIMIT 1`,
    [tokenHash]
  );
  const record = rows[0];
  if (!record) return null;
  if (record.used_at) return null;
  if (new Date(record.expires_at) < new Date()) return null;
  return record;
}

async function markUsed(id) {
  const pool = getPool();
  await pool.query(
    "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id]
  );
}

module.exports = {
  createForUser,
  findValidByToken,
  markUsed,
  TOKEN_TTL_MINUTES,
};
