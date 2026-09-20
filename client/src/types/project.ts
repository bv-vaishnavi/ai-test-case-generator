export type ReviewState = "pending" | "approved" | "rejected";
export type ItemKind = "workflows" | "rules" | "userStories" | "testCases";
export interface ReviewItem {
  _id: string;
  title: string;
  description: string;
  workflowId: string;
  reviewState: ReviewState;
  explicit: boolean;
  approved: boolean;
}
export interface TestCase extends ReviewItem {
  type: "positive" | "negative" | "edge" | "validation";
  preconditions: string[];
  steps: string[];
  expectedResult: string;
}
export interface Attachment {
  _id: string;
  fileName: string;
  size: number;
  mimeType: string;
}
export interface Design {
  category: "Functional" | "Validation" | "UI" | "API";
  technique: string;
  format: "standard" | "bdd-gherkin" | "bdd-2";
  outputTypes: string[];
}
export interface Project {
  _id: string;
  name: string;
  context: {
    description: string;
    additionalContext?: string;
    sourceType?: "text" | "file";
    fileName?: string;
    extractedText?: string;
  };
  attachments: Attachment[];
  design: Design;
  workflows: ReviewItem[];
  rules: ReviewItem[];
  userStories: ReviewItem[];
  testCases: TestCase[];
  status:
    | "created"
    | "context_added"
    | "configured"
    | "generating"
    | "generated"
    | "completed";
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  generationStartedAt?: string;
}
