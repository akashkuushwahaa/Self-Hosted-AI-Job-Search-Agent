// Reciprocal rank fusion: score = Σ 1/(k + rank) over every list an id appears in.
// k = 60 is the constant from the original paper (Cormack et al., 2009).
export function rrf(lists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
