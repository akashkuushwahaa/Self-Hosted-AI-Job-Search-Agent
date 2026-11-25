import { z } from "zod";
import { STATUSES, type Status } from "./tracker";

// Demo mode: every visitor is the same demo user on one shared in-memory database, so tracker
// changes can't go to the database (one visitor's "Remove" would change everyone's board). Each
// visitor's changes live in their own cookie instead, layered over the read-only snapshot.
export const COOKIE = "shortlist-demo-tracker";

// [jobId, status], or [jobId, null] for a removed card; oldest change first.
export type Overlay = [string, Status | null][];

// About 60 bytes each as JSON: 50 keeps the cookie well under the browser's 4 KB limit.
export const MAX_ENTRIES = 50;

const overlaySchema = z.array(z.tuple([z.uuid(), z.enum(STATUSES).nullable()])).max(MAX_ENTRIES);

// The cookie is visitor-controlled: anything that doesn't parse counts as no changes.
export function parseOverlay(raw: string | undefined): Overlay {
  if (!raw) return [];
  try {
    return overlaySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function withChange(overlay: Overlay, jobId: string, status: Status | null): Overlay {
  return [...overlay.filter(([id]) => id !== jobId), [jobId, status] as [string, Status | null]].slice(-MAX_ENTRIES);
}

// The snapshot's cards in their order with the visitor's changes applied; cards they added go last.
export function applyOverlay(snapshot: { jobId: string; status: Status }[], overlay: Overlay) {
  const changes = new Map(overlay);
  const cards = snapshot
    .map((c) => (changes.has(c.jobId) ? { jobId: c.jobId, status: changes.get(c.jobId)! } : c))
    .filter((c): c is { jobId: string; status: Status } => c.status !== null);
  const known = new Set(snapshot.map((c) => c.jobId));
  for (const [jobId, status] of overlay) if (status && !known.has(jobId)) cards.push({ jobId, status });
  return cards;
}
