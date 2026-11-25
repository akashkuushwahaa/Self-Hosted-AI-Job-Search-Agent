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
