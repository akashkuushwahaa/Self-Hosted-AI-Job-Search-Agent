import { z } from "zod";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:7b";

// Ollama only, by design: Shortlist stays local and free, so there is no paid-API provider switch.
export async function generateJson<T extends z.ZodType>(schema: T, system: string, user: string): Promise<z.infer<T>> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: false,
      format: z.toJSONSchema(schema), // constrained decoding: output must match the schema
      // Ollama's default context is too small for a resume plus a job posting.
      options: { temperature: 0, num_ctx: 8192 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Ollama chat failed: HTTP ${res.status} ${await res.text()}`);
  const { message } = (await res.json()) as { message: { content: string } };
  return schema.parse(JSON.parse(message.content));
}
