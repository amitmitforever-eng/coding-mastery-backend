const { Router } = require("express");
const auth = require("../controllers/auth.controller");
const { validate } = require("../utils/validate");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/register", validate(auth.schemas.registerSchema), auth.register);
router.post("/login", validate(auth.schemas.loginSchema), auth.login);
router.post(
  "/forgot-password",
  validate(auth.schemas.forgotPasswordSchema),
  auth.forgotPassword
);
router.post(
  "/reset-password",
  validate(auth.schemas.resetPasswordSchema),
  auth.resetPassword
);
router.get("/me", requireAuth, auth.me);

module.exports = router;
