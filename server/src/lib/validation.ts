import { z } from "zod";
export const text = (max = 2000) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max, `Use ${max} characters or fewer.`);
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);
export const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  );
export const registerInput = z.object({ name: text(80), email, password });
export const loginInput = z.object({
  email,
  password: z.string().min(1).max(200),
});
export const designInput = z.object({
  category: z.enum(["Functional", "Validation", "UI", "API"]),
  technique: z.enum([
    "General",
    "Equivalence Partitioning",
    "Boundary Value Analysis",
    "Decision Table",
    "Exploratory Testing",
  ]),
  format: z.enum(["standard", "bdd-gherkin", "bdd-2"]),
  outputTypes: z
    .array(z.enum(["testCases", "userStories"]))
    .min(1)
    .max(2)
    .default(["testCases"]),
});
export const reviewState = z.enum(["pending", "approved", "rejected"]);
export const kindInput = z.enum([
  "workflows",
  "rules",
  "userStories",
  "testCases",
]);
export const itemUpdate = z
  .object({
    title: text(200).optional(),
    description: text(4000).optional(),
    type: z.enum(["positive", "negative", "edge", "validation"]).optional(),
    preconditions: z.array(text(1000)).max(20).optional(),
    steps: z
      .array(text(1000))
      .min(1, "Include at least one test step.")
      .max(30)
      .optional(),
    expectedResult: text(4000).optional(),
    reviewState: reviewState.optional(),
    explicit: z.boolean().optional(),
    approved: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide a change to save.");
export const bulkInput = z.object({
  ids: z.array(objectId).min(1).max(200),
  action: z.enum(["approve", "reject", "explicit", "delete"]),
});
const aiBase = { title: text(200), description: text(2000) };
const aiCase = z.object({
  title: text(200),
  type: z.enum(["positive", "negative", "edge", "validation"]),
  preconditions: z.array(text(1000)).max(20),
  steps: z.array(text(1000)).min(1).max(30),
  expectedResult: text(4000),
});
export const generationSchema = z
  .object({
    workflows: z
      .array(
        z.object({
          ...aiBase,
          rules: z.array(z.object(aiBase)).min(1).max(12),
          userStories: z.array(z.object(aiBase)).min(1).max(10),
          testCases: z.array(aiCase).min(1).max(30),
        }),
      )
      .min(1)
      .max(6),
  })
  .superRefine((value, ctx) => {
    const cases = value.workflows.flatMap((w) => w.testCases);
    const titles = cases.map((c) => c.title.toLowerCase());
    if (new Set(titles).size !== titles.length)
      ctx.addIssue({ code: "custom", message: "Duplicate test case titles." });
    for (const type of ["positive", "negative", "edge", "validation"])
      if (!cases.some((c) => c.type === type))
        ctx.addIssue({ code: "custom", message: `Missing ${type} coverage.` });
  });
