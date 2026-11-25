// Compares embedding similarity (the retrieval baseline) with LLM scoring on the labeled pairs.
// Writes per-pair outputs to results/latest.json; report.mts holds the metrics.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { embed, jobDocument } from "../../lib/embed";
import { CHAT_MODEL } from "../../lib/llm";
import { profileQuery, scoreMatch, type MatchJob } from "../../lib/match";
import { personas } from "./personas";
import { report as summarize } from "./report";

// `npm run eval:match -- results/v1.json` re-scores a saved run against the current labels instead.
if (process.argv[2]) {
  console.log(summarize(JSON.parse(readFileSync(process.argv[2], "utf8")).results));
  process.exit(0);
}

type Pair = { persona: string; job: MatchJob & { id: string }; label: "good" | "partial" | "poor"; note: string };
const pairs: Pair[] = JSON.parse(readFileSync(new URL("./pairs.json", import.meta.url), "utf8"));

const cosine = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, i) => ((dot += x * b[i]), (na += x * x), (nb += b[i] * b[i])));
  return dot / Math.sqrt(na * nb);
};

const queries = Object.fromEntries(
  await Promise.all(Object.entries(personas).map(async ([k, p]) => [k, (await embed([profileQuery(p)], "search_query"))[0]])),
);
const docs = await embed(pairs.map((p) => jobDocument(p.job)), "search_document");

const results = [];
const started = Date.now();
for (const [i, pair] of pairs.entries()) {
  results.push({
    ...pair,
    job: { id: pair.job.id, title: pair.job.title, company: pair.job.company },
    similarity: cosine(queries[pair.persona], docs[i]),
    ...(await scoreMatch(personas[pair.persona], pair.job)),
  });
  process.stdout.write(`\r${i + 1}/${pairs.length}`);
}

const report = `model ${CHAT_MODEL}, ${((Date.now() - started) / 1000).toFixed(0)}s\n${summarize(results)}`;
console.log(report);
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
writeFileSync(new URL("./results/latest.json", import.meta.url), JSON.stringify({ report, results }, null, 2) + "\n");
