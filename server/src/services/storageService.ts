import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../lib/errors.js";

const LOCAL_PREFIX = "local/";
function driver() {
  return (process.env.STORAGE_DRIVER || "s3").toLowerCase();
}
function storage() {
  if (!process.env.S3_BUCKET || !process.env.AWS_REGION)
    throw new AppError(
      503,
      "File uploads need S3 configuration. Set STORAGE_DRIVER=local for local development.",
    );
  return {
    client: new S3Client({
      region: process.env.AWS_REGION,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 20_000 },
    }),
    bucket: process.env.S3_BUCKET,
  };
}
function localRoot() {
  return path.resolve(process.env.LOCAL_UPLOAD_DIR || "uploads");
}
function localPath(key: string) {
  if (!key.startsWith(LOCAL_PREFIX))
    throw new AppError(500, "Invalid local attachment key.");
  const root = localRoot();
  const target = path.resolve(root, key.slice(LOCAL_PREFIX.length));
  if (target !== root && !target.startsWith(`${root}${path.sep}`))
    throw new AppError(500, "Invalid local attachment path.");
  return target;
}
export async function storeAttachment(
  file: Express.Multer.File,
  userId: string,
  projectId: string,
) {
  const relative = `requirements/${userId}/${projectId}/${randomUUID()}.${file.mimetype === "application/pdf" ? "pdf" : "txt"}`;
  if (driver() === "local") {
    const key = `${LOCAL_PREFIX}${relative}`;
    const target = localPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await writeFile(target, file.buffer, { flag: "wx" });
    } catch {
      throw new AppError(503, "The attachment could not be stored locally.");
    }
    return key;
  }
  if (driver() !== "s3")
    throw new AppError(500, "STORAGE_DRIVER must be either local or s3.");
  const { client, bucket } = storage();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relative,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: "AES256",
      }),
    );
  } catch {
    throw new AppError(
      503,
      "The attachment could not be stored. Please try again.",
    );
  }
  return relative;
}
export async function removeAttachment(key: string) {
  if (key.startsWith(LOCAL_PREFIX)) {
    await rm(localPath(key), { force: true });
    return;
  }
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
export async function readAttachment(key: string): Promise<Buffer> {
  if (key.startsWith(LOCAL_PREFIX)) {
    try {
      return await readFile(localPath(key));
    } catch {
      throw new AppError(404, "The attachment file was not found.");
    }
  }
  const { client, bucket } = storage();
  try {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!object.Body) throw new Error("S3 object has no body");
    return Buffer.from(await object.Body.transformToByteArray());
  } catch {
    throw new AppError(503, "The attachment could not be downloaded.");
  }
}
