// Prints the metrics table for a results file, using the labels currently in pairs.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isNonSkill } from "../../lib/skills";
import { auc, prf } from "../metrics";

type Result = {
  job: { id: string };
  persona: string;
  similarity: number;
  score: number;
  locationFit?: string;
  matchedSkills?: string[];
  missingSkills?: string[];
};

export function report(results: Result[]) {
  const pairs: { persona: string; job: { id: string }; label: string; locationRule?: boolean }[] = JSON.parse(
    readFileSync(join("evals", "match", "pairs.json"), "utf8"),
  );
  const label = new Map(pairs.map((p) => [`${p.persona}/${p.job.id}`, p.label]));
  const labels = results.map((r) => label.get(`${r.persona}/${r.job.id}`));
  const rule = new Set(pairs.filter((p) => p.locationRule).map((p) => `${p.persona}/${p.job.id}`));
  const ruled = results.filter((r) => rule.has(`${r.persona}/${r.job.id}`));
  const caught = ruled.filter((r) => r.locationFit === "blocked").length;
  const tags = results.flatMap((r) => [...(r.matchedSkills ?? []), ...(r.missingSkills ?? [])]);
  const junk = tags.filter(isNonSkill).length;
  const strict = labels.map((l) => l === "good");
  const lenient = labels.map((l) => l !== "poor");
  const sim = results.map((r) => r.similarity);
  const llm = results.map((r) => r.score);
  const f = (n: number) => n.toFixed(2);
  const row = (scores: number[]) => {
    const s = prf(scores.map((x) => x >= 85), strict);
    const l = prf(scores.map((x) => x >= 40), lenient);
    return { s, l };
  };
  const c = row(llm);
  return `${results.length} pairs: ${strict.filter(Boolean).length} good, ${lenient.filter(Boolean).length - strict.filter(Boolean).length} partial

                      strict (good)   lenient (good+partial)
AUC  embedding similarity     ${f(auc(sim, strict))}            ${f(auc(sim, lenient))}
AUC  match score              ${f(auc(llm, strict))}            ${f(auc(llm, lenient))}
P/R/F1 (>=85 | >=40)          ${f(c.s.precision)}/${f(c.s.recall)}/${f(c.s.f1)}   ${f(c.l.precision)}/${f(c.l.recall)}/${f(c.l.f1)}
Stated location rules caught  ${caught}/${ruled.length}
Non-skill tags (heuristic)    ${junk}/${tags.length} (${((100 * junk) / Math.max(1, tags.length)).toFixed(0)}%)`;
}

