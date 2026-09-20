import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AppError } from "../lib/errors.js";
import { loginInput, registerInput } from "../lib/validation.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

function session(user: {
  _id: unknown;
  name: string;
  email: string;
  tokenVersion: number;
}) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError(503, "Authentication is not configured.");
  return {
    token: jwt.sign(
      { userId: String(user._id), version: user.tokenVersion },
      secret,
      { expiresIn: "1h", algorithm: "HS256" },
    ),
    user: { id: user._id, name: user.name, email: user.email },
  };
}
export async function register(req: Request, res: Response) {
  const input = registerInput.parse(req.body);
  const user = await User.create({
    ...input,
    password: await bcrypt.hash(input.password, 12),
  });
  res.status(201).json(session(user));
}
export async function login(req: Request, res: Response) {
  const input = loginInput.parse(req.body);
  const user = await User.findOne({ email: input.email }).select("+password");
  if (!user || !(await bcrypt.compare(input.password, user.password)))
    throw new AppError(401, "Invalid email or password.");
  res.json(session(user));
}
export async function logout(req: AuthRequest, res: Response) {
  await User.updateOne({ _id: req.userId }, { $inc: { tokenVersion: 1 } });
  res.json({ message: "Signed out." });
}
export async function profile(req: AuthRequest, res: Response) {
  const user = await User.findById(req.userId).select("name email");
  res.json({ user: { id: user?._id, name: user?.name, email: user?.email } });
}
