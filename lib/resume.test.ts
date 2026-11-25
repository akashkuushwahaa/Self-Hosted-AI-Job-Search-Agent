import { describe, expect, it } from "vitest";
import { extractResumeText, MAX_RESUME_BYTES } from "./resume";

// Smallest valid one-page PDF with a text object; xref offsets are computed so the parser accepts it.
function pdfWithText(text: string) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${`BT /F1 12 Tf 10 50 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 10 50 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe("extractResumeText", () => {
  it("reads text from a PDF", async () => {
    expect(await extractResumeText(pdfWithText("Akash TypeScript Postgres"))).toContain("Akash TypeScript Postgres");
  });

  it("rejects non-PDF bytes", async () => {
    await expect(extractResumeText(new TextEncoder().encode("hello"))).rejects.toThrow("isn't a PDF");
  });

  it("rejects files over the size limit", async () => {
    await expect(extractResumeText(new Uint8Array(MAX_RESUME_BYTES + 1))).rejects.toThrow("5 MB");
  });

  it("rejects a PDF with no text", async () => {
    await expect(extractResumeText(pdfWithText(""))).rejects.toThrow("No text found");
  });
});
