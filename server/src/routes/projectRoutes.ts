import { Router } from "express";
import {
  createProject,
  getProjects,
  getProjectById,
  updateProjectContext,
  uploadProjectContext,
  updateProjectDesign,
  deleteAttachment,
  downloadAttachment,
} from "../controllers/projectController.js";

import { uploadRequirementFile } from "../middleware/uploadMiddleware.js";
const router = Router();

router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.put("/:id/context", updateProjectContext);
router.post(
  "/:id/context/file",
  uploadRequirementFile.single("file"),
  uploadProjectContext,
);
router.delete("/:id/attachments/:attachmentId", deleteAttachment);
router.get("/:id/attachments/:attachmentId/download", downloadAttachment);
router.put("/:id/design", updateProjectDesign);
export default router;
