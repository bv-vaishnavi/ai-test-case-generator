import mongoose from "mongoose";
mongoose.set("bufferCommands", false);
mongoose.set("maxTimeMS", 10000);
export async function connectDatabase(): Promise<void> {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  console.log("MongoDB connected.");
}
