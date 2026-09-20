import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { S3Client } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import app from "../src/app.js";
import { Project } from "../src/models/Project.js";
import { User } from "../src/models/User.js";
import { requirementText } from "../src/services/projectService.js";

let mongo: MongoMemoryServer;
let token: string, otherToken: string, userId: string;
const suite = {
  workflows: [
    {
      title: "Account access",
      description: "Sign in to an existing account.",
      rules: [
        {
          title: "Valid credentials required",
          description: "Only a matching email and password grants access.",
        },
      ],
      userStories: [
        {
          title: "Sign in",
          description:
            "As a user I want to sign in so that I can access my account.",
        },
      ],
      testCases: ["positive", "negative", "edge", "validation"].map((type) => ({
        title: `${type} login scenario`,
        type,
        preconditions: ["A registered account exists"],
        steps: ["Open login", "Submit credentials"],
        expectedResult: "Access follows the specified credential rules.",
      })),
    },
  ],
};
const auth = () => ({ Authorization: `Bearer ${token}` });
async function create(description = "User login with email and password") {
  const res = await request(app)
    .post("/api/projects")
    .set(auth())
    .send({ name: "Login project", description })
    .expect(201);
  return res.body.project;
}
before(async () => {
  process.env.JWT_SECRET = "test-secret-with-at-least-thirty-two-characters";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.S3_BUCKET;
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.init();
  const first = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Test User",
      email: "test@example.com",
      password: "long-password-123",
    })
    .expect(201);
  token = first.body.token;
  userId = first.body.user.id;
  const second = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Other User",
      email: "other@example.com",
      password: "long-password-123",
    })
    .expect(201);
  otherToken = second.body.token;
});
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

test("validates registration, login and duplicate normalized emails", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({ name: " ", email: "invalid", password: "tiny" })
    .expect(400);
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Test",
      email: " TEST@example.com ",
      password: "long-password-123",
    })
    .expect(409);
  await request(app)
    .post("/api/auth/login")
    .send({ email: { $ne: null }, password: "wrong" })
    .expect(400);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "test@example.com", password: "wrong" })
    .expect(401);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: " TEST@EXAMPLE.COM ", password: "long-password-123" })
    .expect(200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.password, undefined);
});
test("requires authentication and isolates project ownership", async () => {
  const p = await create();
  await request(app).get(`/api/projects/${p._id}`).expect(401);
  await request(app)
    .get(`/api/projects/${p._id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .expect(404);
  await request(app)
    .put(`/api/projects/${p._id}/context`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ description: "overwrite" })
    .expect(404);
  await request(app).get("/api/projects/not-an-id").set(auth()).expect(400);
});
test("preserves original requirement when adding context and validates empty context", async () => {
  const p = await create();
  const res = await request(app)
    .put(`/api/projects/${p._id}/context`)
    .set(auth())
    .send({ additionalContext: "Lock out after five failed attempts." })
    .expect(200);
  assert.equal(res.body.project.context.description, p.context.description);
  const saved = await Project.findById(p._id);
  assert.match(requirementText(saved!), /Lock out/);
  assert.match(requirementText(saved!), /email and password/);
  const empty = await create("");
  await request(app)
    .put(`/api/projects/${empty._id}/context`)
    .set(auth())
    .send({ description: "" })
    .expect(400);
  await request(app)
    .post("/api/projects")
    .set(auth())
    .send({ name: 7 })
    .expect(400);
});
test("rejects invalid uploads and reports missing storage without crashing", async () => {
  const p = await create();
  await request(app)
    .post(`/api/projects/${p._id}/context/file`)
    .set(auth())
    .attach("file", Buffer.from("bad"), {
      filename: "bad.png",
      contentType: "image/png",
    })
    .expect(400);
  await request(app)
    .post(`/api/projects/${p._id}/context/file`)
    .set(auth())
    .attach("file", Buffer.from("not a PDF"), {
      filename: "bad.pdf",
      contentType: "application/pdf",
    })
    .expect(400);
  await request(app)
    .post(`/api/projects/${p._id}/context/file`)
    .set(auth())
    .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: "large.txt",
      contentType: "text/plain",
    })
    .expect(400);
  await request(app)
    .post(`/api/projects/${p._id}/context/file`)
    .set(auth())
    .attach("file", Buffer.from("Valid requirement"), {
      filename: "story.txt",
      contentType: "text/plain",
    })
    .expect(503);
  await request(app).get("/api/health").expect(200);
});
test("stores attachments through S3 and keeps extracted text for generation", async (t) => {
  process.env.S3_BUCKET = "test-bucket";
  process.env.AWS_REGION = "us-east-1";
  const calls: string[] = [];
  t.mock.method(S3Client.prototype, "send", async (command) => {
    calls.push(command.constructor.name);
    return {};
  });
  t.after(() => {
    delete process.env.S3_BUCKET;
  });
  const p = await create();
  const uploaded = await request(app)
    .post(`/api/projects/${p._id}/context/file`)
    .set(auth())
    .attach("file", Buffer.from("Password is required"), {
      filename: "story.txt",
      contentType: "text/plain",
    })
    .expect(201);
  assert.equal(uploaded.body.project.attachments.length, 1);
  assert.match(
    requirementText((await Project.findById(p._id))!),
    /Password is required/,
  );
  const file = uploaded.body.project.attachments[0];
  const removed = await request(app)
    .delete(`/api/projects/${p._id}/attachments/${file._id}`)
    .set(auth())
    .expect(200);
  assert.equal(removed.body.project.attachments.length, 0);
  assert.deepEqual(calls, ["PutObjectCommand", "DeleteObjectCommand"]);
});
test("generates structured workflows and persists edits, approvals, export and cascade deletion", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(suite) }] } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  const p = await create();
  await request(app)
    .put(`/api/projects/${p._id}/design`)
    .set(auth())
    .send({ category: "Functional", technique: "General", format: "standard" })
    .expect(200);
  const generated = await request(app)
    .post(`/api/projects/${p._id}/generate`)
    .set(auth())
    .send({})
    .expect(200);
  assert.equal(generated.body.project.testCases.length, 4);
  const c = generated.body.project.testCases[0],
    workflow = generated.body.project.workflows[0];
  const approved = await request(app)
    .post(`/api/projects/${p._id}/items/testCases/bulk`)
    .set(auth())
    .send({ ids: [c._id], action: "approve" })
    .expect(200);
  assert.equal(approved.body.project.testCases[0].reviewState, "approved");
  const edited = await request(app)
    .put(`/api/projects/${p._id}/items/testCases/${c._id}`)
    .set(auth())
    .send({
      title: "Updated title",
      steps: ["Open login", "Enter valid credentials"],
    })
    .expect(200);
  assert.equal(edited.body.project.testCases[0].title, "Updated title");
  assert.equal(edited.body.project.testCases[0].reviewState, "pending");
  await request(app)
    .put(`/api/projects/${p._id}/items/testCases/${c._id}`)
    .set(auth())
    .send({ steps: [] })
    .expect(400);
  await request(app)
    .put(`/api/projects/${p._id}/items/testCases/${c._id}`)
    .set(auth())
    .send({ steps: [7] })
    .expect(400);
  const reloaded = await request(app)
    .get(`/api/projects/${p._id}`)
    .set(auth())
    .expect(200);
  assert.equal(reloaded.body.project.testCases[0].title, "Updated title");
  const exported = await request(app)
    .post(`/api/projects/${p._id}/export`)
    .set(auth())
    .send({ ids: [c._id] })
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.body);
  assert.equal(workbook.worksheets[0].rowCount, 2);
  assert.equal(workbook.worksheets[0].getCell("C2").value, "Updated title");
  const deleted = await request(app)
    .post(`/api/projects/${p._id}/items/workflows/bulk`)
    .set(auth())
    .send({ ids: [workflow._id], action: "delete" })
    .expect(200);
  assert.equal(deleted.body.project.testCases.length, 0);
  assert.equal(deleted.body.project.rules.length, 0);
});
test("rejects concurrent generation and recovers an expired generation lock", async () => {
  const p = await create();
  await Project.updateOne(
    { _id: p._id },
    {
      $set: {
        status: "generating",
        generationToken: "lock",
        generationStartedAt: new Date(),
      },
    },
  );
  await request(app)
    .post(`/api/projects/${p._id}/generate`)
    .set(auth())
    .send({})
    .expect(409);
  await request(app)
    .put(`/api/projects/${p._id}/context`)
    .set(auth())
    .send({ description: "changed" })
    .expect(409);
  await Project.updateOne(
    { _id: p._id },
    { $set: { generationStartedAt: new Date(Date.now() - 250_000) } },
  );
  const recovered = await request(app)
    .get(`/api/projects/${p._id}`)
    .set(auth())
    .expect(200);
  assert.equal(recovered.body.project.status, "configured");
});
test("AI failures leave saved results intact", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({ error: { code: 400, message: "provider error" } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
  );
  const p = await create();
  await Project.updateOne(
    { _id: p._id },
    {
      $set: {
        testCases: [
          {
            title: "Keep me",
            type: "positive",
            steps: ["Run"],
            expectedResult: "Pass",
          },
        ],
      },
    },
  );
  await request(app)
    .post(`/api/projects/${p._id}/regenerate`)
    .set(auth())
    .send({})
    .expect(502);
  const saved = await Project.findById(p._id);
  assert.equal(saved!.testCases[0].title, "Keep me");
  assert.equal(saved!.status, "generated");
});
test("malformed JSON, unknown routes and disallowed origins return JSON errors", async () => {
  const malformed = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send("{bad")
    .expect(400);
  assert.ok(malformed.body.message);
  await request(app).get("/api/missing").expect(404);
  await request(app)
    .get("/api/health")
    .set("Origin", "https://untrusted.example")
    .expect(403);
});
