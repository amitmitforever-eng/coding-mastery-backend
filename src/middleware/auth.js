const HttpError = require("../utils/httpError");
const { verifyToken } = require("../utils/jwt");

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Missing or invalid Authorization header"));
  }
  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, role: decoded.role, email: decoded.email };
    next();
  } catch (_err) {
    next(new HttpError(401, "Invalid or expired token"));
  }
}

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Not authenticated"));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new HttpError(403, "Forbidden: insufficient role"));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
