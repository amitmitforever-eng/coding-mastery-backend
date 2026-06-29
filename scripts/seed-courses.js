/**
 * Seed the 24 "Course Wheel" courses into the `courses` table.
 *
 * Idempotent: safe to run multiple times.
 *   - Looks up (or creates) a single "Coding Mastery" platform teacher
 *     account that owns every seeded course.
 *   - For each course in `seed-data/courses.json` it INSERTs a new row
 *     when the slug is missing, or UPDATEs the existing row when it's
 *     already there - so re-running this script keeps the catalogue in
 *     sync with the JSON file without disturbing teacher-created courses.
 *   - Each seeded course is set to `status='approved'` with staggered
 *     `created_at` timestamps so the wheel order matches the reference
 *     image (React.js -> Next.js -> ... -> AWS).
 *
 * Usage (from `coding-mastery-backend`):
 *   npm run seed-courses
 *
 * To regenerate the JSON snapshot from the frontend's TS source:
 *   cd ../coding-mastery-frontend && npx tsx scripts/dump-courses.ts
 */
require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");

const { initDb, getPool } = require("../src/config/db");

const PLATFORM_TEACHER = {
  name: "Coding Mastery",
  email: "platform@codingmastery.local",
  // Password is only used if someone tries to log in as the platform
  // account; admins / real users never need it. We still hash it.
  password: "PlatformDoNotLogin!2026",
  contact: null,
  role: "teacher",
};

async function ensurePlatformTeacher(pool) {
  const [existing] = await pool.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [PLATFORM_TEACHER.email]
  );
  if (existing.length > 0) return existing[0].id;

  const hash = await bcrypt.hash(PLATFORM_TEACHER.password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, contact, role) VALUES (?, ?, ?, ?, ?)",
    [
      PLATFORM_TEACHER.name,
      PLATFORM_TEACHER.email,
      hash,
      PLATFORM_TEACHER.contact,
      PLATFORM_TEACHER.role,
    ]
  );
  console.log(
    `  + created platform teacher (id=${result.insertId}, email=${PLATFORM_TEACHER.email})`
  );
  return result.insertId;
}

function toCoursePayload(c) {
  return {
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    duration: c.duration || null,
    language: c.language || "English",
    certificate: c.certificate ?? true,
    imageUrl: c.imageUrl || null,
    imageGradient:
      c.imageGradient || "from-slate-700 via-slate-800 to-slate-900",
    youtubeUrl: c.youtubeUrl || null,
    instructor: {
      name: c.instructor.name,
      title: c.instructor.title || null,
      bio: c.instructor.bio || null,
      experienceYears: c.instructor.experienceYears ?? null,
      expertise: c.instructor.expertise || [],
      usersTaught: c.instructor.usersTaught || null,
    },
    levels: c.levels,
  };
}

async function upsertCourse(pool, course, teacherId, createdAt) {
  const slug = course.id; // frontend `id` IS the slug
  const data = toCoursePayload(course);

  const [existing] = await pool.query(
    "SELECT id FROM courses WHERE slug = ? LIMIT 1",
    [slug]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE courses SET
        title = ?, description = ?, category = ?, difficulty = ?,
        duration = ?, language = ?, certificate = ?,
        image_url = ?, image_gradient = ?, youtube_url = ?,
        instructor_name = ?, instructor_title = ?, instructor_bio = ?,
        instructor_experience_years = ?, instructor_expertise = ?,
        instructor_users_taught = ?, levels_json = ?,
        status = 'approved'
      WHERE id = ?`,
      [
        data.title,
        data.description,
        data.category,
        data.difficulty,
        data.duration,
        data.language,
        data.certificate ? 1 : 0,
        data.imageUrl,
        data.imageGradient,
        data.youtubeUrl,
        data.instructor.name,
        data.instructor.title,
        data.instructor.bio,
        data.instructor.experienceYears,
        JSON.stringify(data.instructor.expertise),
        data.instructor.usersTaught,
        JSON.stringify(data.levels),
        existing[0].id,
      ]
    );
    return { action: "updated", id: existing[0].id };
  }

  const [result] = await pool.query(
    `INSERT INTO courses (
      slug, title, description, category, difficulty, duration, language, certificate,
      image_url, image_gradient, youtube_url,
      instructor_name, instructor_title, instructor_bio, instructor_experience_years,
      instructor_expertise, instructor_users_taught,
      levels_json, teacher_id, status,
      submitted_at, approved_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
    [
      slug,
      data.title,
      data.description,
      data.category,
      data.difficulty,
      data.duration,
      data.language,
      data.certificate ? 1 : 0,
      data.imageUrl,
      data.imageGradient,
      data.youtubeUrl,
      data.instructor.name,
      data.instructor.title,
      data.instructor.bio,
      data.instructor.experienceYears,
      JSON.stringify(data.instructor.expertise),
      data.instructor.usersTaught,
      JSON.stringify(data.levels),
      teacherId,
      createdAt,
      createdAt,
      createdAt,
      createdAt,
    ]
  );
  return { action: "inserted", id: result.insertId };
}

async function seed() {
  const seedFile = path.join(__dirname, "..", "seed-data", "courses.json");
  if (!fs.existsSync(seedFile)) {
    throw new Error(
      `Seed file not found: ${seedFile}\n` +
        `Run: cd ../coding-mastery-frontend && npx tsx scripts/dump-courses.ts`
    );
  }
  const courses = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  console.log(`Loaded ${courses.length} courses from ${seedFile}`);

  await initDb();
  const pool = getPool();

  const teacherId = await ensurePlatformTeacher(pool);
  console.log(`Platform teacher id = ${teacherId}\n`);

  // Stagger created_at so the API's `ORDER BY created_at DESC` returns
  // courses in the same order as the wheel (React.js first, AWS last).
  // We give the FIRST course the most-recent timestamp.
  const now = Date.now();
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < courses.length; i += 1) {
    const c = courses[i];
    const createdAt = new Date(now - i * 60_000); // 1 minute apart
    const { action } = await upsertCourse(pool, c, teacherId, createdAt);
    console.log(
      `  ${action === "inserted" ? "+" : "~"} ${c.id.padEnd(20)} ${c.title}`
    );
    if (action === "inserted") inserted += 1;
    else updated += 1;
  }

  console.log(`\nDone. Inserted ${inserted}, updated ${updated}.`);
  console.log(
    "All seeded courses are owned by the platform teacher and marked 'approved'."
  );
  console.log(
    "Teacher-created courses are untouched - they continue to live alongside seeds."
  );

  await pool.end();
}

seed().catch((err) => {
  console.error("[seed-courses] Failed:", err.message || err);
  process.exit(1);
});
