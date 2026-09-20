import express from "express";
import { authenticateToken } from "./middleware/authMiddleware.js";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import generationRoutes from "./routes/generationRoutes.js";
import { AppError, errorHandler } from "./lib/errors.js";
const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
        .split(",")
        .map((v) => v.trim());
      callback(
        origin && !allowed.includes(origin)
          ? new AppError(403, "Origin is not allowed.")
          : null,
        true,
      );
    },
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests. Please wait a minute." },
  }),
);
app.get("/api/health", (_req, res) => {
  res.json({ message: "Test Case Generator API is running" });
});
app.use("/api/auth", authRoutes);
app.use("/api/projects", authenticateToken, projectRoutes, generationRoutes);
app.use((_req, _res, next) => next(new AppError(404, "Endpoint not found.")));
app.use(errorHandler);
export default app;
