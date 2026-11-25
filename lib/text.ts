export type Block = { kind: "p" | "ul"; lines: string[] };

// Splits a job description (plain text from lib/boards.ts, bullets as "• ") into paragraphs and lists.
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current = null as Block | null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      current = null; // a blank line ends the block
      continue;
    }
    const kind = line.startsWith("•") ? "ul" : "p";
    const content = kind === "ul" ? line.slice(1).trim() : line;
    if (current?.kind !== kind) {
      current = { kind, lines: [] };
      blocks.push(current);
    }
    current.lines.push(content);
  }
  return blocks;
}

// Qwen sometimes switches to Chinese mid-sentence ("...should consider relocating,虽"). Cut at the
// switch and end on the last complete sentence before it.
const OTHER_SCRIPT = /[　-ヿ㐀-鿿가-힯＀-￯]/;
export function cleanReason(reason: string): string {
  const at = reason.search(OTHER_SCRIPT);
  if (at === -1) return reason;
  const before = reason.slice(0, at);
  const lastStop = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "));
  return (lastStop === -1 ? before : before.slice(0, lastStop + 1)).trim();
}
