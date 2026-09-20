import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AppError } from "../lib/errors.js";
export interface AuthRequest extends Request {
  userId?: string;
}
export async function authenticateToken(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new AppError(401, "Please sign in to continue.");
  if (!process.env.JWT_SECRET)
    throw new AppError(503, "Authentication is not configured.");
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new AppError(401, "Your session has expired. Please sign in again.");
  }
  if (
    typeof decoded === "string" ||
    typeof decoded.userId !== "string" ||
    !/^[a-f\d]{24}$/i.test(decoded.userId)
  )
    throw new AppError(401, "Invalid session.");
  const user = await User.findById(decoded.userId)
    .select("tokenVersion")
    .lean();
  if (!user || (decoded.version ?? 0) !== user.tokenVersion)
    throw new AppError(401, "Your session has expired. Please sign in again.");
  req.userId = decoded.userId;
  next();
}
