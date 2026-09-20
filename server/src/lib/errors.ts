import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: error.issues[0]?.message || "Invalid input",
      errors: error.flatten().fieldErrors,
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Files must be 5 MB or smaller."
          : "Upload one PDF or TXT file at a time.",
    });
    return;
  }
  if (error instanceof mongoose.Error.VersionError) {
    res.status(409).json({
      message:
        "This project changed in another request. Refresh and try again.",
    });
    return;
  }
  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    res.status(400).json({ message: "Invalid data. Please check your input." });
    return;
  }
  if (error?.code === 11000) {
    res
      .status(409)
      .json({ message: "An account with this email already exists." });
    return;
  }
  const status =
    error instanceof AppError
      ? error.status
      : error?.type === "entity.too.large"
        ? 413
        : error instanceof SyntaxError && "body" in error
          ? 400
          : 500;
  if (status >= 500)
    console.error(
      "Request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
  res.status(status).json({
    message:
      error instanceof AppError
        ? error.message
        : status === 413
          ? "Request is too large."
          : status === 400
            ? "Invalid JSON request."
            : "Something went wrong. Please try again.",
  });
};
