// Semantic search always has a nearest job, so without a cutoff any query ("pastry chef") returns
// 100 "matches". Measured with nomic-embed-text on the ingested jobs (cosine distance):
// - nonsense queries' nearest job is 0.40+ (asdf qwerty 0.436, nurse 0.426, truck driver 0.406)
// - real queries' good hits sit below 0.40 (LLM evaluation 0.35–0.39, frontend internship in India from 0.276)
// - past about best + 0.08 the list drifts off topic (machine learning intern: 0.2 best, unrelated interns from 0.28)
export const MAX_DISTANCE = 0.4;
export const BAND = 0.08;

// `hits` must be sorted nearest first.
export function relevant<T extends { distance: number }>(hits: T[]): T[] {
  if (!hits.length) return [];
  const limit = Math.min(MAX_DISTANCE, hits[0].distance + BAND);
  return hits.filter((h) => h.distance < limit);
}
