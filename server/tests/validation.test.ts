import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generationSchema,
  itemUpdate,
  password,
} from "../src/lib/validation.js";
import { extractTextFromFile } from "../src/services/documentService.js";
test("rejects empty steps and non-string preconditions", () => {
  assert.equal(itemUpdate.safeParse({ steps: [] }).success, false);
  assert.equal(itemUpdate.safeParse({ preconditions: [42] }).success, false);
});
test("rejects an empty AI suite and missing coverage", () => {
  assert.equal(generationSchema.safeParse({ workflows: [] }).success, false);
  assert.equal(
    generationSchema.safeParse({
      workflows: [
        {
          title: "Flow",
          description: "desc",
          rules: [{ title: "Rule", description: "desc" }],
          userStories: [{ title: "Story", description: "desc" }],
          testCases: [
            {
              title: "Case",
              type: "positive",
              preconditions: [],
              steps: ["Run"],
              expectedResult: "Pass",
            },
          ],
        },
      ],
    }).success,
    false,
  );
});
test("enforces bcrypt byte limit for unicode passwords", () => {
  assert.equal(password.safeParse("😀".repeat(19)).success, false);
  assert.equal(password.safeParse("correct-long-password").success, true);
});
test("rejects binary TXT and empty content", async () => {
  await assert.rejects(
    extractTextFromFile({
      mimetype: "text/plain",
      buffer: Buffer.from([0xff, 0xfe]),
    } as Express.Multer.File),
  );
  await assert.rejects(
    extractTextFromFile({
      mimetype: "text/plain",
      buffer: Buffer.from("  "),
    } as Express.Multer.File),
  );
});
