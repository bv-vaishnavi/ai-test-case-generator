import mongoose from "mongoose";
const reviewFields = {
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, default: "" },
  workflowId: { type: String, default: "" },
  reviewState: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  explicit: { type: Boolean, default: false },
  approved: { type: Boolean, default: false },
};
const itemSchema = new mongoose.Schema(reviewFields);
const testCaseSchema = new mongoose.Schema({
  ...reviewFields,
  type: {
    type: String,
    enum: ["positive", "negative", "edge", "validation"],
    required: true,
  },
  preconditions: { type: [String], default: [] },
  steps: { type: [String], default: [] },
  expectedResult: { type: String, required: true },
});
const attachmentSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  key: { type: String, required: true },
  size: Number,
  mimeType: String,
  extractedText: { type: String, required: true },
});
const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    context: {
      type: new mongoose.Schema(
        {
          description: { type: String, default: "" },
          additionalContext: { type: String, default: "" },
          sourceType: { type: String, enum: ["text", "file"], default: "text" },
          fileName: String,
          extractedText: { type: String, default: "" },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    attachments: { type: [attachmentSchema], default: [] },
    design: {
      type: new mongoose.Schema(
        {
          outputTypes: {
            type: [String],
            enum: ["testCases", "userStories"],
            default: ["testCases"],
          },
          category: { type: String, default: "Functional" },
          technique: { type: String, default: "General" },
          format: {
            type: String,
            enum: ["standard", "bdd-gherkin", "bdd-2"],
            default: "standard",
          },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    workflows: { type: [itemSchema], default: [] },
    rules: { type: [itemSchema], default: [] },
    userStories: { type: [itemSchema], default: [] },
    testCases: { type: [testCaseSchema], default: [] },
    status: {
      type: String,
      enum: [
        "created",
        "context_added",
        "configured",
        "generating",
        "generated",
        "completed",
      ],
      default: "created",
    },
    generationToken: { type: String, select: false },
    generationStartedAt: Date,
    generatedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true },
);
projectSchema.index({ userId: 1, updatedAt: -1 });
export const Project = mongoose.model("Project", projectSchema);
