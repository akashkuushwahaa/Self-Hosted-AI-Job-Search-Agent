# Match scoring eval

Measures whether LLM scoring (`lib/match.ts`) ranks jobs better than embedding similarity alone, which is how candidates are retrieved before scoring.

```bash
npm run eval:match   # needs Ollama with nomic-embed-text and CHAT_MODEL pulled
```

## The set

`pairs.json`: 3 fictional candidates (`personas.ts`) × 16 job postings snapshotted from the live boards, so the set does not change when postings close. Per candidate: the 10 nearest jobs by embedding (the hard cases) plus 6 seeded-random ones. Rebuild with `npx tsx --env-file=.env evals/match/build-set.mts`; that overwrites the labels.

Labels, with a one-line `note` on each pair. Levels by years: intern/new grad (<1), junior (1-2), mid (3-4), senior (5-7), staff+ (8+). Posted years are a minimum: seniority "fits" when the candidate meets them or is at most a year short, is a "stretch" one level short, and is "far" two or more levels short. Over-qualification counts only for intern and new-grad roles.

- **good**: a target role type, seniority that fits, and a location the candidate can work from (moving within their own country counts as workable).
- **partial**: a real fit with one obstacle (moving to another country, a seniority stretch, an adjacent role).
- **poor**: wrong function, seniority that is far off, or a stated location or work-authorization requirement the candidate fails.

**The labels are drafts written by Claude Code from the postings' requirement lines.** Review them before quoting any number from this eval.

## Metrics

- **AUC**: how often a positive pair outranks a negative one (threshold-free, so embedding similarity and LLM scores compare fairly). Reported for strict (good) and lenient (good or partial) positives.
- **Precision / recall / F1** of the LLM at the rubric's band edges: score ≥ 85 for strict, ≥ 40 for lenient.
- **Stated location rules caught**: of the 9 pairs labeled `locationRule` (the posting states a location or work-authorization rule the candidate fails), how many come out "blocked".
- **Non-skill tags**: share of skill tags that name a trait, perk or requirement rather than a skill, by the word list in `lib/skills.ts`. Since v4 the app filters tags with that same list, so from v4 on this only shows the filter runs; the 26% in v2 is the model's own rate.

One run at temperature 0. Per-pair scores and reasons are in `results/latest.json`. `npm run eval:match -- evals/match/results/<file>.json` re-scores a saved run against the current labels.

## Results

`qwen2.5:7b` on an M4 Mac with 16 GB, about 26 minutes per run. Every row uses the current labels and is re-scored from `results/`.

| Version | AUC strict | AUC lenient | F1 lenient (≥40) | Location rules |
|---|---|---|---|---|
| Embedding similarity only | 0.72 | 0.71 | n/a | n/a |
| v1: model judges role, seniority and location; code caps the score | 0.90 | 0.85 | 0.65 (P 0.71, R 0.59) | n/a |
| v2: model extracts the posting's minimum years; code computes seniority | 0.89 | 0.84 | 0.82 (P 0.82, R 0.82) | 5/9 |
| v3: no model score; score = skill coverage, capped by the same checks | 0.87 | 0.72 | 0.64 (P 0.82, R 0.53) | n/a |
| v4: model quotes the location rule; code decides it; tags filtered | 0.95 | 0.89 | 0.83 (P 1.00, R 0.71) | 9/9 |
| v5: without an exact quote, location from the job's own location field | 0.94 | 0.91 | 0.81 (P 0.75, R 0.88) | 4/9 |
| **v6 (shipped)**: a quote counts if the posting has a rule sentence naming the same place | **0.97** | **0.91** | **0.87** (P 1.00, R 0.76) | **9/9** |

What the per-pair output shows:

- LLM reranking beats embedding similarity in every row. The gates are what make the scores usable: the raw score sits at 65 for most pairs.
- Extraction is reliable (required years matched the postings), but judgment is not: the 7B model still labels some exact role matches "adjacent" and misses a few location rules.
- Strict "good" detection (≥85) is 0 in v1 and v2, because no capped score reaches 85.
- v3 fixed that ceiling (two good jobs scored 83 and 91, strict precision 1.00) but lost on everything else: with no model score to soften them, every mislabeled check (an internship in the candidate's own country marked "blocked", exact role matches marked "different") went straight into the score. Its skill lists also still included traits like "Judgment". v2 stays.
- `qwen2.5:14b` would be the next lever, but it does not run on 16 GB with the 8k context a resume plus a posting needs: Ollama's runner crashed on the first real call.
- v4 to v6 apply "the model extracts, code decides" to location. The model is asked to quote the posting's location rule. It quoted real rules but often paraphrased them ("Must be based in Gurugram" for "We are looking to speak to candidates who are based in Gurugram"), and sometimes invented one from the job's city. v5 required an exact quote and so dropped real rules (4/9). v6 accepts a quote when the posting has a rule sentence (based in, authorized to work, eligible, onsite) naming the same place, decides from that sentence, and otherwise judges the move from the job's location field.
- v6 has no false positives. Its four misses: two role-fit errors by the model (a full-stack SDE2 role and an internship called "different" work), and two postings with a stated "based in Toronto" or "within Ireland" rule that code blocks for a candidate in Berlin while the labels allow relocating. Code knows countries, not visa regimes such as EU free movement.

48 pairs with draft labels is a small set: read these numbers as direction, not precision.
