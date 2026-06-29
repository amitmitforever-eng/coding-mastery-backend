const path = require("path");
const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve user uploads (e.g. course cover images). The `cors()` headers
  // above don't apply to static files, so add the few we need by hand
  // — without them `<img>` works but `next/image` complains in some
  // browsers when CORP is enforced.
  const uploadsDir = path.join(__dirname, "..", "uploads");
  app.use(
    "/uploads",
    (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", env.corsOrigin);
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(uploadsDir, {
      fallthrough: true,
      maxAge: "7d",
    })
  );

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
