import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  register,
  login,
  logout,
  profile,
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many attempts. Try again in 15 minutes." },
});
router.post("/register", limiter, register);
router.post("/login", limiter, login);
router.post("/logout", authenticateToken, logout);
router.get("/profile", authenticateToken, profile);
export default router;
