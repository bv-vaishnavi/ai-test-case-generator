import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  generateProjectTestCases,
  updateTestCase,
  updateItem,
  bulkItems,
  exportTestCases,
} from "../controllers/generationController.js";
const router = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (req) =>
    (req as import("../middleware/authMiddleware.js").AuthRequest).userId!,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Please wait a minute before generating again." },
});
router.post("/:id/generate", limiter, generateProjectTestCases);
router.post("/:id/regenerate", limiter, generateProjectTestCases);
router.put("/:id/test-cases/:testCaseId", updateTestCase);
router.put("/:id/items/:kind/:itemId", updateItem);
router.post("/:id/items/:kind/bulk", bulkItems);
router.post("/:id/export", exportTestCases);
export default router;
