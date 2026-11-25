import { extractText, getDocumentProxy } from "unpdf";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export class ResumeError extends Error {}

// Throws ResumeError with a message safe to show the user.
export async function extractResumeText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_RESUME_BYTES) throw new ResumeError("Resume must be 5 MB or smaller");
  // Check the file signature instead of trusting the browser's content type.
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new ResumeError("That file isn't a PDF");
  let text: string;
  try {
    ({ text } = await extractText(await getDocumentProxy(bytes), { mergePages: true }));
  } catch {
    throw new ResumeError("Couldn't read that PDF");
  }
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  // shortcut: no OCR, so scanned resumes are rejected; add tesseract.js if users hit this.
  if (!text) throw new ResumeError("No text found in that PDF. Scanned resumes aren't supported yet");
  return text;
}
