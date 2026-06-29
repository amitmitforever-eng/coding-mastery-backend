const HttpError = require("../utils/httpError");

function notFound(_req, _res, next) {
  next(new HttpError(404, "Route not found"));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const isHttp = err instanceof HttpError;
  const status = isHttp ? err.status : 500;
  const payload = {
    error: {
      message: isHttp ? err.message : "Internal server error",
    },
  };
  if (isHttp && err.details) payload.error.details = err.details;
  if (!isHttp) {
    console.error("[error]", err);
  }
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
