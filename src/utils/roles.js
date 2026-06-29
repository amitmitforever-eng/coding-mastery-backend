/** Canonical account roles (matches `users.role` ENUM in db.js). */
const ROLES = Object.freeze(["user", "teacher", "admin"]);

/** Roles the admin user-management panel may list / suspend / delete. */
const MANAGEABLE_ROLES = Object.freeze(["user", "teacher"]);

const DEFAULT_ROLE = "user";

/** True when `value` is one of the known account roles. */
function isRole(value) {
  return typeof value === "string" && ROLES.includes(value);
}

/** True when `value` is manageable through the admin user panel. */
function isManageableRole(value) {
  return typeof value === "string" && MANAGEABLE_ROLES.includes(value);
}

module.exports = {
  ROLES,
  MANAGEABLE_ROLES,
  DEFAULT_ROLE,
  isRole,
  isManageableRole,
};
