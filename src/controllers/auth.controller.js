const bcrypt = require("bcryptjs");
const { z } = require("zod");

const env = require("../config/env");
const HttpError = require("../utils/httpError");
const { signToken } = require("../utils/jwt");
const UserModel = require("../models/user.model");
const PasswordResetModel = require("../models/passwordReset.model");
const EmailService = require("../services/email.service");
const { DEFAULT_ROLE, ROLES } = require("../utils/roles");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128),
  contact: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Contact must be a 10 digit number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  role: z.enum(ROLES).default(DEFAULT_ROLE),
  // Required only when role === "admin". We let the controller enforce it
  // so we can return a clear, role-specific message.
  adminCode: z
    .string()
    .trim()
    .max(128)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(ROLES).optional(),
  remember: z.boolean().optional(),
  // Required only when logging in as an admin. Validated by the controller
  // against ADMIN_REGISTRATION_CODE for a clear, role-specific message.
  adminCode: z
    .string()
    .trim()
    .max(128)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email"),
  role: z.enum(ROLES).optional(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, "Invalid reset token"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128),
});

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    contact: user.contact ?? null,
    role: user.role,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, contact, role, adminCode } = req.body;

    // Admin registration is gated by a shared secret configured in the
    // backend's .env (ADMIN_REGISTRATION_CODE). Without it - or with a
    // wrong code - we refuse the request entirely. The rest of the body
    // is not even saved.
    if (role === "admin") {
      if (!adminCode) {
        throw new HttpError(
          403,
          "Admin code is required to register as an admin."
        );
      }
      if (adminCode !== env.adminRegistrationCode) {
        throw new HttpError(403, "Invalid admin code.");
      }
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Teachers are created in a "pending" state and must be approved by an
    // admin before they can log in. Users and admins are active right away.
    const status = role === "teacher" ? "pending" : "active";

    const user = await UserModel.createUser({
      name,
      email,
      passwordHash,
      contact,
      role,
      status,
    });

    // Pending teachers are NOT logged in (no token). They get a message and
    // must wait for admin approval.
    if (role === "teacher") {
      return res.status(201).json({
        pending: true,
        status: "pending",
        message:
          "Your teacher account has been submitted and is awaiting admin approval. You'll be able to log in once an admin approves it.",
        user: publicUser(user),
      });
    }

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password, role, adminCode } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new HttpError(401, "Invalid email or password");
    }

    // Soft-deleted accounts can never sign in (the row is kept for history,
    // but the person is locked out until an admin restores them).
    if (user.is_deleted) {
      throw new HttpError(
        403,
        "This account has been removed. Please contact the administrator."
      );
    }

    // Suspended accounts (any role) are blocked until an admin reactivates.
    if (user.status === "suspended") {
      throw new HttpError(
        403,
        "Your account has been suspended. Please contact the administrator."
      );
    }

    if (role && user.role !== role) {
      throw new HttpError(
        403,
        `This account is registered as ${user.role}, not ${role}`
      );
    }

    // Admin logins require the shared admin code (same secret used for admin
    // registration), as an extra gate on the privileged portal.
    if (user.role === "admin") {
      if (!adminCode) {
        throw new HttpError(403, "Admin code is required to log in as an admin.");
      }
      if (adminCode !== env.adminRegistrationCode) {
        throw new HttpError(403, "Invalid admin code.");
      }
    }

    // Teacher accounts are gated behind admin approval.
    if (user.role === "teacher") {
      if (user.status === "pending") {
        throw new HttpError(
          403,
          "Your teacher account is awaiting admin approval. Please try again once it has been approved."
        );
      }
      if (user.status === "rejected") {
        throw new HttpError(
          403,
          "Your teacher registration was not approved. Please contact the administrator."
        );
      }
    }

    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) throw new HttpError(404, "User not found");
    // If the account was suspended or soft-deleted while the user held a valid
    // token, lock them out on the next session check so the frontend logs out.
    if (user.is_deleted) {
      throw new HttpError(401, "This account has been removed.");
    }
    if (user.status === "suspended") {
      throw new HttpError(403, "Your account has been suspended.");
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);

    let resetUrl;
    if (user) {
      const { rawToken, expiresInMinutes } =
        await PasswordResetModel.createForUser(user.id);
      resetUrl = `${env.frontendUrl.replace(
        /\/$/,
        ""
      )}/reset-password?token=${rawToken}&role=${encodeURIComponent(
        user.role
      )}`;

      try {
        await EmailService.sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
          expiresInMinutes,
        });
      } catch (mailErr) {
        // Don't surface mail failures to the user; log and move on.
        console.error(
          `[auth] Failed to send reset email to ${email}:`,
          mailErr.message
        );
      }
    } else {
      console.log(
        `[auth] Password reset requested for unknown email: ${email}`
      );
    }

    // Same response whether or not the email exists, to prevent enumeration.
    const response = {
      message:
        "If an account exists for this email, a password reset link has been sent.",
    };
    if (env.nodeEnv !== "production" && resetUrl) {
      response.devResetUrl = resetUrl;
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const record = await PasswordResetModel.findValidByToken(token);
    if (!record) {
      throw new HttpError(400, "Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await UserModel.updatePassword(record.user_id, passwordHash);
    await PasswordResetModel.markUsed(record.id);

    res.json({
      message: "Password updated. You can now sign in with your new password.",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
  schemas: {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
  },
};
