import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { Project } from "../models/Project.js";
import { AppError } from "../lib/errors.js";
import { designInput, objectId, text } from "../lib/validation.js";
import { ownedProject, requirementText } from "../services/projectService.js";
import { extractTextFromFile } from "../services/documentService.js";
import {
  storeAttachment,
  removeAttachment,
  readAttachment,
} from "../services/storageService.js";

export async function createProject(req: AuthRequest, res: Response) {
  const input = z
    .object({
      name: text(100),
      description: z.string().trim().max(50_000).default(""),
    })
    .parse(req.body);
  const project = await Project.create({
    userId: req.userId,
    name: input.name,
    context: { description: input.description },
    status: input.description ? "context_added" : "created",
  });
  res.status(201).json({ project });
}
export async function getProjects(req: AuthRequest, res: Response) {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(1)
    .parse(req.query.page);
  const [projects, total] = await Promise.all([
    Project.find({ userId: req.userId })
      .select("name status updatedAt createdAt generatedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    Project.countDocuments({ userId: req.userId }),
  ]);
  res.json({ projects, total, page, pages: Math.ceil(total / 20) });
}
export async function getProjectById(req: AuthRequest, res: Response) {
  const project = await ownedProject(req.params.id, req.userId);
  res.json({ project });
}
export async function updateProjectContext(req: AuthRequest, res: Response) {
  const input = z
    .object({
      description: z.string().trim().max(50_000).optional(),
      additionalContext: z.string().trim().max(20_000).optional(),
    })
    .refine(
      (v) => v.description !== undefined || v.additionalContext !== undefined,
      "Provide requirement text or additional context.",
    )
    .parse(req.body);
  const project = await ownedProject(req.params.id, req.userId, true);
  Object.assign(project.context!, input);
  if (input.description !== undefined && project.context?.sourceType !== "file")
    project.context!.extractedText = "";
  if (!requirementText(project).trim())
    throw new AppError(400, "Enter a requirement or attach a document.");
  if (requirementText(project).length > 80_000)
    throw new AppError(
      400,
      "Combined context must be 80,000 characters or fewer.",
    );
  project.status = "context_added";
  await project.save();
  res.json({ project });
}
export async function uploadProjectContext(req: AuthRequest, res: Response) {
  const project = await ownedProject(req.params.id, req.userId, true);
  if (!req.file) throw new AppError(400, "Choose a PDF or TXT file.");
  if (project.attachments.length >= 5)
    throw new AppError(400, "A project can have at most five attachments.");
  const extractedText = await extractTextFromFile(req.file);
  if (requirementText(project).length + extractedText.length > 79_000)
    throw new AppError(
      400,
      "Combined context is too long. Remove a document or shorten your requirements.",
    );
  const key = await storeAttachment(req.file, req.userId!, String(project._id));
  project.attachments.push({
    key,
    fileName: req.file.originalname.slice(0, 200),
    size: req.file.size,
    mimeType: req.file.mimetype,
    extractedText,
  });
  project.status = "context_added";
  try {
    await project.save();
  } catch (error) {
    await removeAttachment(key).catch(() =>
      console.error("Orphaned attachment cleanup failed."),
    );
    throw error;
  }
  res.status(201).json({ project });
}
export async function deleteAttachment(req: AuthRequest, res: Response) {
  const project = await ownedProject(req.params.id, req.userId, true);
  const file = project.attachments.id(objectId.parse(req.params.attachmentId));
  if (!file) throw new AppError(404, "Attachment not found.");
  const key = file.key;
  file.deleteOne();
  project.status = "context_added";
  await project.save();
  await removeAttachment(key).catch(() =>
    console.error("Detached attachment cleanup failed."),
  );
  res.json({ project });
}
export async function downloadAttachment(req: AuthRequest, res: Response) {
  const project = await ownedProject(req.params.id, req.userId);
  const file = project.attachments.id(objectId.parse(req.params.attachmentId));
  if (!file) throw new AppError(404, "Attachment not found.");
  const contents = await readAttachment(file.key);
  const safeName = file.fileName.replace(/[\r\n"\\/]/g, "_");
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  res.setHeader("Content-Length", contents.length);
  res.send(contents);
}
export async function updateProjectDesign(req: AuthRequest, res: Response) {
  const input = designInput.parse(req.body);
  const project = await ownedProject(req.params.id, req.userId, true);
  if (!requirementText(project).trim())
    throw new AppError(400, "Add requirements before configuring generation.");
  project.design = input;
  project.status = "configured";
  await project.save();
  res.json({ project });
}
