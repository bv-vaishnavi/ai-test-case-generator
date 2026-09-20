export function validateFile(file: File) {
  if (!["application/pdf", "text/plain"].includes(file.type))
    return "Only PDF and TXT files are supported.";
  if (file.size > 5 * 1024 * 1024) return "Files must be 5 MB or smaller.";
  if (!file.size) return "This file is empty.";
  return "";
}
