import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO } from "./demo";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

// nomic-embed-text is trained with these task prefixes; queries and documents must use their own.
export type Task = "search_query" | "search_document";

// Demo mode has no model: it replays embeddings recorded by scripts/build-demo.mts.
export const recordingKey = (task: Task, text: string) => `${task}:${createHash("sha256").update(text).digest("hex")}`;
let recorded: Record<string, number[]> | undefined;

export async function embed(texts: string[], task: Task, timeoutMs = 120_000): Promise<number[][]> {
  if (DEMO) {
    recorded ??= JSON.parse(readFileSync(join(process.cwd(), "demo", "embeddings.json"), "utf8"));
    return texts.map((t) => {
      const v = recorded![recordingKey(task, t)];
      if (!v) throw new Error("not recorded for the demo"); // callers already fall back, e.g. to keyword search
      return v;
    });
  }
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => `${task}: ${t}`) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status} ${await res.text()}`);
  const { embeddings } = (await res.json()) as { embeddings: number[][] };
  return embeddings;
}

export function jobDocument(j: { title: string; company: string; location: string | null; description: string }) {
  // The head of a posting carries the role summary; the tail is mostly benefits and legal boilerplate.
  return `${j.title} at ${j.company}${j.location ? ` (${j.location})` : ""}\n\n${j.description.slice(0, 2000)}`;
}
