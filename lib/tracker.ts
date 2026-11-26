import { z } from "zod";

export const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export const parseStatus = (value: unknown): Status | null =>
  STATUSES.includes(value as Status) ? (value as Status) : null;

export function groupByStatus<T extends { status: Status }>(cards: T[]): Record<Status, T[]> {
  const columns = Object.fromEntries(STATUSES.map((s) => [s, [] as T[]])) as Record<Status, T[]>;
  for (const card of cards) columns[card.status].push(card);
  return columns;
}

export type FollowUp = "overdue" | "today" | "upcoming";

// Dates are calendar days ("YYYY-MM-DD"), compared as strings; `today` is the viewer's own date.
// Offers and rejections are finished, so their follow-ups never nag.
export function followUpDue(followUpOn: string | null, status: Status, today: string): FollowUp | null {
  if (!followUpOn || status === "offer" || status === "rejected") return null;
  return followUpOn < today ? "overdue" : followUpOn === today ? "today" : "upcoming";
}

// The browser's local calendar date, for followUpDue.
export const localToday = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const blankToNull = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);
const day = z.preprocess(blankToNull, z.iso.date("Use a date like 2026-11-26").nullable());
const text = (max: number, label: string) => z.preprocess(blankToNull, z.string().max(max, `${label} is too long`).nullable());

const detailsSchema = z.object({
  appliedOn: day,
  nextStep: text(200, "Next step"),
  followUpOn: day,
  notes: text(5000, "Notes"),
});
export type Details = z.infer<typeof detailsSchema>;

export function parseDetails(form: FormData): { ok: true; details: Details } | { ok: false; error: string } {
  const parsed = detailsSchema.safeParse({
    appliedOn: form.get("appliedOn"),
    nextStep: form.get("nextStep"),
    followUpOn: form.get("followUpOn"),
    notes: form.get("notes"),
  });
  return parsed.success ? { ok: true, details: parsed.data } : { ok: false, error: parsed.error.issues[0].message };
}
