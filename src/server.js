const env = require("./config/env");
const createApp = require("./app");
const { initDb } = require("./config/db");

async function start() {
  try {
    await initDb();
    console.log(`[db] connected to '${env.db.database}' on ${env.db.host}:${env.db.port}`);

    const app = createApp();
    app.listen(env.port, () => {
      console.log(`[server] listening on http://localhost:${env.port}`);
      console.log(`[server] CORS origin: ${env.corsOrigin}`);
    });
  } catch (err) {
    console.error("[server] failed to start:", err.message);
    process.exit(1);
  }
}

start();
