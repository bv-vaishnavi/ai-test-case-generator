import multer from "multer";
import { AppError } from "../lib/errors.js";
export const uploadRequirementFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 50_000 },
  fileFilter: (_req, file, callback) => {
    if (!["application/pdf", "text/plain"].includes(file.mimetype)) {
      callback(new AppError(400, "Only PDF and TXT files are supported."));
      return;
    }
    callback(null, true);
  },
});
