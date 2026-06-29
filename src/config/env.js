require("dotenv").config();

const {
  YOUTUBE_CHANNEL_HANDLE,
  YOUTUBE_CHANNEL_URL,
  canonicalChannelUrl,
} = require("../utils/youtube");

const required = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[config] Missing required env vars: ${missing.join(", ")}. ` +
      `Copy .env.example to .env and fill in the values.`
  );
  process.exit(1);
}

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  // When true (or NODE_ENV=development), admins can wipe all accounts via API.
  allowDevReset:
    process.env.ALLOW_DEV_RESET === "true" ||
    (process.env.NODE_ENV || "development") === "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // Secret code required to register a new admin account. The frontend asks
  // for it on the register form when "Admin" is selected; the backend
  // validates it against this value. Override it in .env for production.
  adminRegistrationCode:
    process.env.ADMIN_REGISTRATION_CODE || "CM-ADMIN-2026",
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASSWORD || null,
    from:
      process.env.EMAIL_FROM ||
      "Coding Mastery <no-reply@codingmastery.local>",
  },
  youtube: {
    // Free key from Google Cloud Console (YouTube Data API v3). Without it the
    // /api/videos/playlists endpoint returns an empty list + a hint.
    apiKey: process.env.YOUTUBE_API_KEY || null,
    // The channel handle (without the leading @) OR an explicit channel id.
    // The handle is resolved to a channel id on first use and cached.
    channelHandle:
      (process.env.YOUTUBE_CHANNEL_HANDLE || YOUTUBE_CHANNEL_HANDLE).replace(
        /^@/,
        ""
      ),
    channelId: process.env.YOUTUBE_CHANNEL_ID || null,
    channelUrl: canonicalChannelUrl(
      process.env.YOUTUBE_CHANNEL_URL || YOUTUBE_CHANNEL_URL
    ),
  },
};

module.exports = env;
