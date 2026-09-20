import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid port number.");
  await connectDatabase();
  const server = app.listen(port, () =>
    console.log(`API listening on http://localhost:${port}`),
  );
  server.requestTimeout = 210000;
  server.on("error", () => {
    console.error("Unable to start HTTP server. Check the configured port.");
    void mongoose.disconnect().finally(() => process.exit(1));
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      server.close(() => {
        void mongoose.disconnect().finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
}
startServer().catch((error) => {
  console.error(
    "Startup failed:",
    error instanceof Error && !error.name.startsWith("Mongo")
      ? error.message
      : "Database connection unavailable. Check MONGODB_URI.",
  );
  process.exit(1);
});
