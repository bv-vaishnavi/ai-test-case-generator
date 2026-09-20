import { PDFParse } from "pdf-parse";
import { AppError } from "../lib/errors.js";
export async function extractTextFromFile(
  file: Express.Multer.File,
): Promise<string> {
  let text = "";
  if (file.mimetype === "text/plain") {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
    } catch {
      throw new AppError(400, "Upload a UTF-8 encoded text file.");
    }
    if (text.includes("\0"))
      throw new AppError(400, "The file is not plain text.");
  } else if (file.mimetype === "application/pdf") {
    if (file.buffer.subarray(0, 5).toString() !== "%PDF-")
      throw new AppError(400, "This file is not a valid PDF.");
    const parser = new PDFParse({ data: file.buffer });
    try {
      text = (await parser.getText()).text;
    } catch {
      throw new AppError(
        400,
        "Unable to read this PDF. Upload an unlocked, text-based PDF.",
      );
    } finally {
      await parser.destroy();
    }
  } else throw new AppError(400, "Only PDF and TXT files are supported.");
  text = text.trim();
  if (!text)
    throw new AppError(
      400,
      "No readable text found. Scanned PDFs require OCR; paste their text instead.",
    );
  if (text.length > 50_000)
    throw new AppError(
      400,
      "This document is too long. Use at most 50,000 characters.",
    );
  return text;
}
