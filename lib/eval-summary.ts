// Headline numbers from the latest match eval (evals/match), read at build time, so the home page
// and the link-preview image always show what the last `npm run eval:match` measured.
import latest from "@/evals/match/results/latest.json";
import { auc } from "@/evals/metrics";

// "Lenient" AUC, the one the README quotes: good and partial matches count as positive.
export const MATCH_AUC = auc(
  latest.results.map((r) => r.score),
  latest.results.map((r) => r.label !== "poor"),
).toFixed(2);
export const EVAL_PAIRS = latest.results.length;
