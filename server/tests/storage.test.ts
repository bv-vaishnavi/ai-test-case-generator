import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readAttachment,
  removeAttachment,
  storeAttachment,
} from "../src/services/storageService.js";

let temporaryDirectory = "";
afterEach(async () => {
  delete process.env.STORAGE_DRIVER;
  delete process.env.LOCAL_UPLOAD_DIR;
  if (temporaryDirectory)
    await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = "";
});

test("stores, reads, and removes attachments with the local driver", async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "melo-uploads-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_UPLOAD_DIR = temporaryDirectory;
  const contents = Buffer.from("Local requirement document");
  const key = await storeAttachment(
    {
      buffer: contents,
      mimetype: "text/plain",
    } as Express.Multer.File,
    "user-id",
    "project-id",
  );

  assert.match(key, /^local\/requirements\/user-id\/project-id\/.+\.txt$/);
  assert.deepEqual(await readAttachment(key), contents);
  assert.deepEqual(
    await readFile(path.join(temporaryDirectory, key.slice("local/".length))),
    contents,
  );

  await removeAttachment(key);
  await assert.rejects(readAttachment(key), /not found/);
});
