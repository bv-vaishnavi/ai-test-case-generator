import type { Response } from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import { Project } from "../models/Project.js";
import { generateTestCases } from "../services/aiService.js";
import { ownedProject, requirementText } from "../services/projectService.js";
import { AppError } from "../lib/errors.js";
import {
  bulkInput,
  designInput,
  itemUpdate,
  kindInput,
  objectId,
} from "../lib/validation.js";

export async function generateProjectTestCases(
  req: AuthRequest,
  res: Response,
) {
  const project = await ownedProject(req.params.id, req.userId, true);
  const { feedback } = z
    .object({ feedback: z.string().trim().max(2000).default("") })
    .parse(req.body || {});
  const requirement = requirementText(project);
  if (!requirement.trim())
    throw new AppError(400, "Add project requirements before generating.");
  if (requirement.length > 80_000)
    throw new AppError(400, "Combined requirements exceed 80,000 characters.");
  const design = designInput.parse(project.design);
  const token = randomUUID();
  const locked = await Project.findOneAndUpdate(
    {
      _id: project._id,
      userId: req.userId,
      __v: project.__v,
      $or: [
        { status: { $ne: "generating" } },
        { generationStartedAt: { $lt: new Date(Date.now() - 240_000) } },
      ],
    },
    {
      $set: {
        status: "generating",
        generationToken: token,
        generationStartedAt: new Date(),
      },
      $inc: { __v: 1 },
    },
  );
  if (!locked)
    throw new AppError(
      409,
      "This project changed or is already generating. Refresh and try again.",
    );
  try {
    const suite = await generateTestCases(
      requirement + (feedback ? `\nRegeneration feedback: ${feedback}` : ""),
      design,
    );
    const workflows: Record<string, unknown>[] = [],
      rules: Record<string, unknown>[] = [],
      userStories: Record<string, unknown>[] = [],
      testCases: Record<string, unknown>[] = [];
    for (const workflow of suite.workflows) {
      const _id = new mongoose.Types.ObjectId();
      workflows.push({
        _id,
        title: workflow.title,
        description: workflow.description,
      });
      const workflowId = String(_id);
      rules.push(...workflow.rules.map((item) => ({ ...item, workflowId })));
      userStories.push(
        ...workflow.userStories.map((item) => ({ ...item, workflowId })),
      );
      testCases.push(
        ...workflow.testCases.map((item) => ({ ...item, workflowId })),
      );
    }
    const updated = await Project.findOneAndUpdate(
      { _id: project._id, generationToken: token },
      {
        $set: {
          workflows,
          rules,
          userStories,
          testCases,
          status: "generated",
          generatedAt: new Date(),
        },
        $unset: { generationToken: 1, generationStartedAt: 1 },
        $inc: { __v: 1 },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated)
      throw new AppError(
        409,
        "Generation was superseded. Refresh to see the current project.",
      );
    res.json({ project: updated });
  } catch (error) {
    await Project.updateOne(
      { _id: project._id, generationToken: token },
      {
        $set: { status: project.testCases.length ? "generated" : "configured" },
        $unset: { generationToken: 1, generationStartedAt: 1 },
        $inc: { __v: 1 },
      },
    );
    throw error;
  }
}
function updateCompletion(project: InstanceType<typeof Project>) {
  project.status =
    project.testCases.length &&
      project.testCases.every((c) => c.reviewState === "approved")
      ? "completed"
      : "generated";
}
export async function updateTestCase(req: AuthRequest, res: Response) {
  req.params.kind = "testCases";
  req.params.itemId = req.params.testCaseId;
  return updateItem(req, res);
}
export async function updateItem(req: AuthRequest, res: Response) {
  const kind = kindInput.parse(req.params.kind);
  const input = itemUpdate.parse(req.body);
  const project = await ownedProject(req.params.id, req.userId, true);
  const item = project[kind].id(objectId.parse(req.params.itemId));
  if (!item) throw new AppError(404, "Item not found.");
  if (
    kind !== "testCases" &&
    ["steps", "preconditions", "type", "expectedResult"].some(
      (key) => key in input,
    )
  )
    throw new AppError(400, "These fields only apply to test cases.");
  const hasContentChange = [
    "title",
    "description",
    "steps",
    "preconditions",
    "expectedResult",
    "type",
  ].some((key) => key in input);
  Object.assign(item, input);
  if (hasContentChange) {
    item.reviewState = "pending";
    item.approved = false;
  } else if (input.approved !== undefined)
    item.reviewState = input.approved ? "approved" : "pending";
  item.approved = item.reviewState === "approved";
  updateCompletion(project);
  await project.save();
  res.json({ project });
}
export async function bulkItems(req: AuthRequest, res: Response) {
  const kind = kindInput.parse(req.params.kind);
  const input = bulkInput.parse(req.body);
  const project = await ownedProject(req.params.id, req.userId, true);
  const items = input.ids.map((id) => project[kind].id(id));
  if (items.some((item) => !item))
    throw new AppError(
      404,
      "A selected item no longer exists. Refresh and try again.",
    );
  for (const item of items) {
    if (!item) continue;
    if (input.action === "delete") {
      if (kind === "workflows")
        for (const childKind of [
          "rules",
          "userStories",
          "testCases",
        ] as const) {
          for (const child of [...project[childKind]])
            if (child.workflowId === String(item._id)) child.deleteOne();
        }
      item.deleteOne();
    } else if (input.action === "explicit") item.explicit = true;
    else {
      item.reviewState = input.action === "approve" ? "approved" : "rejected";
      item.approved = item.reviewState === "approved";
    }
  }
  updateCompletion(project);
  await project.save();
  res.json({ project });
}
export async function exportTestCases(req: AuthRequest, res: Response) {
  const project = await ownedProject(req.params.id, req.userId);
  const { ids } = z
    .object({ ids: z.array(objectId).max(200).optional() })
    .parse(req.body || {});
  const cases = ids
    ? project.testCases.filter((c) => ids.includes(String(c._id)))
    : project.testCases;
  if (!cases.length)
    throw new AppError(400, "Select at least one test case to export.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MELO";
  const sheet = workbook.addWorksheet("Test Cases", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "ID", key: "id", width: 12 },
    { header: "Workflow", key: "workflow", width: 26 },
    { header: "Title", key: "title", width: 40 },
    { header: "Type", key: "type", width: 14 },
    { header: "Preconditions", key: "preconditions", width: 40 },
    { header: "Steps", key: "steps", width: 55 },
    { header: "Expected Result", key: "expectedResult", width: 55 },
    { header: "Review", key: "review", width: 14 },
  ];
  cases.forEach((c, index) =>
    sheet.addRow({
      id: `TC-${index + 1}`,
      workflow:
        project.workflows.find((w) => String(w._id) === c.workflowId)?.title ||
        "",
      title: c.title,
      type: c.type,
      preconditions: c.preconditions.join("\n"),
      steps: c.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      expectedResult: c.expectedResult,
      review: c.reviewState,
    }),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3E455C" },
  };
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  sheet.autoFilter = { from: "A1", to: "H1" };
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="test-cases.xlsx"',
  );
  res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
}
