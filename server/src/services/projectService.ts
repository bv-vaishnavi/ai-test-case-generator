import { Project } from "../models/Project.js";
import { objectId } from "../lib/validation.js";
import { AppError } from "../lib/errors.js";
export async function ownedProject(
  id: unknown,
  userId: string | undefined,
  mutable = false,
) {
  if (!userId) throw new AppError(401, "Please sign in.");
  let project = await Project.findOne({ _id: objectId.parse(id), userId });
  if (!project) throw new AppError(404, "Project not found.");
  if (
    project.status === "generating" &&
    (!project.generationStartedAt ||
      Date.now() - project.generationStartedAt.getTime() >= 240_000)
  ) {
    const recovered = await Project.findOneAndUpdate(
      { _id: project._id, __v: project.__v, status: "generating" },
      {
        $set: { status: project.testCases.length ? "generated" : "configured" },
        $unset: { generationToken: 1, generationStartedAt: 1 },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    project = recovered || (await Project.findById(project._id));
    if (!project) throw new AppError(404, "Project not found.");
  }
  if (
    mutable &&
    project.status === "generating" &&
    project.generationStartedAt &&
    Date.now() - project.generationStartedAt.getTime() < 240_000
  )
    throw new AppError(
      409,
      "Generation is in progress. Please wait before changing this project.",
    );
  return project;
}
export function requirementText(project: InstanceType<typeof Project>) {
  const context = project.context;
  const original = context?.description || context?.extractedText || "";
  const legacyFile =
    context?.sourceType === "file" && context.extractedText !== original
      ? context.extractedText
      : "";
  return [
    original,
    legacyFile,
    context?.additionalContext,
    ...project.attachments.map(
      (a) => `Document: ${a.fileName}\n${a.extractedText}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}
