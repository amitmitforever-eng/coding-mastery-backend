/**

 * Reset development data: removes all user/teacher/admin accounts and every

 * row that depends on them (courses, enrollments, password-reset tokens,

 * topic-edit requests, topics, course_levels, course_revisions).

 *

 * Usage (from coding-mastery-backend):

 *   npm run reset-data

 *

 * ⚠️  Destructive — intended for local/dev only. Does NOT drop tables.

 */

require("dotenv").config();



const { initDb, getPool } = require("../src/config/db");

const { resetAllTestData } = require("../src/utils/resetTestData");



async function resetData() {

  await initDb();

  const pool = getPool();



  try {

    const summary = await resetAllTestData();

    for (const [table, count] of Object.entries(summary.tables)) {

      console.log(`  cleared ${table} (${count} rows)`);

    }

    console.log("\nDone. All users and course data removed.");

    console.log(

      "Register fresh user / teacher / admin accounts via the frontend."

    );

    console.log(

      "Optional: npm run seed-courses — restores platform teacher + wheel courses."

    );

  } finally {

    await pool.end();

  }

}



resetData().catch((err) => {

  console.error("[reset-data] Failed:", err.message || err);

  process.exit(1);

});

