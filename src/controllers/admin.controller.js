const { z } = require("zod");

const HttpError = require("../utils/httpError");
const UserModel = require("../models/user.model");
const CourseModel = require("../models/course.model");
const { isRole, MANAGEABLE_ROLES } = require("../utils/roles");
const env = require("../config/env");
const { resetAllTestData } = require("../utils/resetTestData");

const RESET_CONFIRM_PHRASE = "DELETE ALL TEST DATA";

const TEACHER_STATUSES = ["active", "pending", "rejected"];

function publicTeacher(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    contact: u.contact ?? null,
    status: u.status,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    contact: u.contact ?? null,
    role: u.role,
    status: u.status,
    isDeleted: !!u.is_deleted,
    deletedAt: u.deleted_at ?? null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

async function loadTeacher(id) {
  const teacher = await UserModel.findById(id);
  if (!teacher || teacher.role !== "teacher") {
    throw new HttpError(404, "Teacher not found");
  }
  return teacher;
}

async function listTeachers(req, res, next) {
  try {
    const raw = req.query.status ? String(req.query.status) : undefined;
    const status = TEACHER_STATUSES.includes(raw) ? raw : undefined;
    const teachers = await UserModel.listTeachers({ status });
    const counts = await UserModel.countTeachersByStatus();
    res.json({ teachers: teachers.map(publicTeacher), counts });
  } catch (err) {
    next(err);
  }
}

async function approveTeacher(req, res, next) {
  try {
    const teacher = await loadTeacher(req.params.id);
    if (teacher.status === "active") {
      throw new HttpError(400, "This teacher account is already approved.");
    }
    await UserModel.updateStatus(teacher.id, "active");
    const updated = await UserModel.findById(teacher.id);
    res.json({ teacher: publicTeacher(updated) });
  } catch (err) {
    next(err);
  }
}

async function rejectTeacher(req, res, next) {
  try {
    const teacher = await loadTeacher(req.params.id);
    if (teacher.status === "rejected") {
      throw new HttpError(400, "This teacher account is already rejected.");
    }
    await UserModel.updateStatus(teacher.id, "rejected");
    const updated = await UserModel.findById(teacher.id);
    res.json({ teacher: publicTeacher(updated) });
  } catch (err) {
    next(err);
  }
}

/* ===================== Unified user management ========================= */

const LIST_STATUSES = [
  "active",
  "pending",
  "rejected",
  "suspended",
  "deleted",
];

const updateUserSchema = z.object({
  name: z
    .string({ required_error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(100, "Name is too long (max 100 characters)."),
  email: z
    .string({ required_error: "Email is required." })
    .trim()
    .toLowerCase()
    .email("Please enter a valid email."),
  contact: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Contact must be a 10 digit number.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Load a user and ensure the admin is allowed to manage it. */
async function loadManageableUser(req) {
  const id = Number(req.params.id);
  const target = await UserModel.findById(id);
  if (!target) throw new HttpError(404, "User not found");

  // Admins are never managed (suspend/delete/etc.) through this panel - that
  // prevents an admin from locking the platform out of its own controls.
  if (target.role === "admin") {
    throw new HttpError(403, "Admin accounts cannot be managed here.");
  }
  if (!MANAGEABLE_ROLES.includes(target.role)) {
    throw new HttpError(403, "This account type cannot be managed here.");
  }
  if (Number(req.user.id) === id) {
    throw new HttpError(400, "You cannot perform this action on yourself.");
  }
  return target;
}

async function listUsers(req, res, next) {
  try {
    const rawRole =
      req.query.role != null ? String(req.query.role) : undefined;
    const role = isRole(rawRole) ? rawRole : undefined;
    const status = LIST_STATUSES.includes(req.query.status)
      ? req.query.status
      : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;

    const users = await UserModel.listUsers({ role, status, search });
    const counts = await UserModel.countUsers();
    res.json({ users: users.map(publicUser), counts });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const target = await UserModel.findById(Number(req.params.id));
    if (!target) throw new HttpError(404, "User not found");
    res.json({ user: publicUser(target) });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const target = await loadManageableUser(req);
    const { name, email, contact } = req.body;

    if (email && email !== target.email) {
      const existing = await UserModel.findByEmail(email);
      if (existing && existing.id !== target.id) {
        throw new HttpError(409, "Another account already uses this email.");
      }
    }
    await UserModel.updateProfile(target.id, { name, email, contact });
    const updated = await UserModel.findById(target.id);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const target = await loadManageableUser(req);
    if (target.is_deleted) {
      throw new HttpError(400, "Restore this account before suspending it.");
    }
    if (target.status === "suspended") {
      throw new HttpError(400, "This account is already suspended.");
    }
    await UserModel.setUserStatus(target.id, "suspended");
    const updated = await UserModel.findById(target.id);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

async function activateUser(req, res, next) {
  try {
    const target = await loadManageableUser(req);
    if (target.is_deleted) {
      throw new HttpError(400, "Restore this account before activating it.");
    }
    if (target.status === "active") {
      throw new HttpError(400, "This account is already active.");
    }
    await UserModel.setUserStatus(target.id, "active");
    const updated = await UserModel.findById(target.id);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft delete. We never DELETE FROM users here. When a teacher is removed we
 * keep their courses and hand ownership to the acting admin so enrollments,
 * payments and reports stay intact.
 */
async function deleteUser(req, res, next) {
  try {
    const target = await loadManageableUser(req);
    if (target.is_deleted) {
      throw new HttpError(400, "This account is already deleted.");
    }

    let reassignedCourses = 0;
    if (target.role === "teacher") {
      reassignedCourses = await CourseModel.reassignTeacher(
        target.id,
        req.user.id
      );
    }
    await UserModel.softDelete(target.id);

    const updated = await UserModel.findById(target.id);
    res.json({ user: publicUser(updated), reassignedCourses });
  } catch (err) {
    next(err);
  }
}

async function restoreUser(req, res, next) {
  try {
    const target = await loadManageableUser(req);
    if (!target.is_deleted) {
      throw new HttpError(400, "This account is not deleted.");
    }
    await UserModel.restore(target.id);
    const updated = await UserModel.findById(target.id);
    res.json({ user: publicUser(updated) });
  } catch (err) {
    next(err);
  }
}

/**
 * Wipe every student, teacher, and admin account plus dependent course data.
 * Dev/testing only — disabled unless ALLOW_DEV_RESET=true or NODE_ENV=development.
 */
async function resetTestData(req, res, next) {
  try {
    if (!env.allowDevReset) {
      throw new HttpError(
        403,
        "Test data reset is disabled on this server. Set ALLOW_DEV_RESET=true in development."
      );
    }
    if (req.body?.confirmPhrase !== RESET_CONFIRM_PHRASE) {
      throw new HttpError(
        400,
        `Type the exact confirmation phrase: ${RESET_CONFIRM_PHRASE}`
      );
    }

    const summary = await resetAllTestData();
    res.json({
      message:
        "All user, teacher, and admin accounts were removed along with courses, enrollments, and related data.",
      ...summary,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTeachers,
  approveTeacher,
  rejectTeacher,
  listUsers,
  getUser,
  updateUser,
  suspendUser,
  activateUser,
  deleteUser,
  restoreUser,
  resetTestData,
  schemas: {
    updateUserSchema,
    resetTestDataSchema: z.object({
      confirmPhrase: z.literal(RESET_CONFIRM_PHRASE),
    }),
  },
};
