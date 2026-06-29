const HttpError = require("./httpError");

function validate(schema, preprocess) {
  return (req, _res, next) => {
    const input = preprocess ? preprocess(req.body) : req.body;
    const result = schema.safeParse(input);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(new HttpError(400, "Validation failed", details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
