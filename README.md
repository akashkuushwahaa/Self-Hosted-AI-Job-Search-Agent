# Shortlist: Self-Hosted AI Job Search Agent

[![CI](https://github.com/akashkuushwahaa/Self-Hosted-AI-Job-Search-Agent/actions/workflows/ci.yml/badge.svg)](https://github.com/akashkuushwahaa/Self-Hosted-AI-Job-Search-Agent/actions/workflows/ci.yml)

Self-hosted AI job search. No paid APIs, no free-tier keys that expire.

Jobs come straight from companies' public career boards (Greenhouse, Lever, Ashby), which need no API key, into Postgres with full-text search.

## Run it

```bash
cp .env.example .env
docker compose up -d --wait   # Postgres 16 + pgvector
npm install
npm run db:migrate
npm run ingest                # ~7k jobs from 33 companies, about a minute
ollama pull nomic-embed-text  # local embedding model, ~270 MB
npm run embed                 # embeds new/changed jobs; ~13 min for 7k on an M-series Mac
ollama pull qwen2.5:7b        # local chat model for match scoring, ~4.7 GB
npm run dev                   # http://localhost:3000
npx playwright install chromium  # headless browser for company research, ~100 MB
npm run worker                # second terminal: scoring, research, and the daily refresh
```

After the first ingest and embed, the worker keeps jobs fresh on its own: every day at 06:00 (local time; `REFRESH_CRON` in `.env`) it ingests every board, embeds new and changed jobs, and scores the new candidates for each user with a profile. A laptop asleep at 06:00 catches up with one run when it wakes.

Set `BETTER_AUTH_SECRET` in `.env` (`openssl rand -base64 32`). Email/password sign-in works out of the box; GitHub sign-in turns on when `GITHUB_CLIENT_ID`/`SECRET` are set.

`npm test` runs the unit tests; `npm run eval:match` runs the match-scoring eval (see [evals/match](evals/match/README.md)). Add a company in `lib/companies.ts`.

## Demo mode (free hosting that doesn't expire)

`DEMO_MODE=1` runs the whole app with no database server, model or API key. The database is [PGlite](https://pglite.dev) (Postgres compiled to WASM, with pgvector) loaded from a committed snapshot, `demo/pgdata.tar.gz`. That snapshot holds 1,272 real jobs, a fictional candidate's 30 scored matches, company briefs and a started tracker. The same Drizzle queries run against it. Model output is recorded rather than live: match scores and briefs are in the snapshot, and `demo/embeddings.json` holds the query embeddings for the demo profile and the sample searches, so semantic search works for those and any other search falls back to keyword. Visitors are signed in as the demo candidate. The tracker works, and each visitor's changes are their own: they live in a cookie layered over the snapshot (`lib/demo-tracker.ts`), never in the shared database. Scoring, research and profile edits explain that they run locally.

Deploy on Vercel's free plan: import the repo and set `DEMO_MODE=1` and `BETTER_AUTH_SECRET`. No other services. To refresh the snapshot (needs Postgres, Ollama and the worker):

```bash
npm run demo:seed    # demo candidate + queues their scoring and a few company briefs
npm run worker       # until the jobs finish
npm run demo:build   # writes demo/pgdata.tar.gz and demo/embeddings.json
```

## Use it from Claude (MCP)

`npm run mcp` starts an MCP server over stdio (`scripts/mcp.mts`) with six tools: `search_jobs`, `get_job`, `list_matches`, `list_tracker`, `track_job` and `company_brief`. It acts as one Shortlist user, picked by email. To add it to Claude Code:

```bash
claude mcp add shortlist -e SHORTLIST_USER_EMAIL=you@example.com -- npm run --silent --prefix /absolute/path/to/shortlist mcp
```

`--silent` matters: stdout is the protocol, and npm's `> shortlist mcp` banner would corrupt it. Inputs are validated by the tool schemas (job ids must be UUIDs, `company_brief` only accepts listed companies, statuses must be one of the board's columns), and `track_job` is the only tool that writes.

## How it works

- `lib/boards.ts` fetches each board, validates the response with Zod, and normalizes it to one job shape.
- `scripts/ingest.mts` upserts jobs, and marks ones a board no longer lists as closed instead of deleting them. A board that fails is skipped, so an outage never closes its jobs.
- Auth is [Better Auth](https://better-auth.com) on the same Postgres (`db/auth-schema.ts`); `lib/session.ts` guards pages and server actions.
- `/profile` saves profile fields with Zod-validated server actions; resume upload checks size and the PDF signature, then stores only the extracted text (`lib/resume.ts`). Upload can also fill in the profile: the local model extracts headline, location, years, skills and suitable roles (`lib/resume-profile.ts`), and code fills only empty fields, adds only skills the resume text actually contains, and never overwrites what you typed.
- Search (`lib/search.ts`) runs a keyword query (Postgres `websearch_to_tsquery` over a GIN index) and a semantic query (pgvector cosine distance over `nomic-embed-text` embeddings), then merges them with reciprocal rank fusion (`lib/rrf.ts`). Semantic hits past a measured distance cutoff are dropped (`lib/relevance.ts`), so a query nothing matches returns nothing instead of the 100 nearest jobs. "frontend internship in India" finds 0 jobs by keyword and relevant Bengaluru and remote roles with hybrid. If Ollama is down, search falls back to keyword-only and says so.
- `/jobs` filters by level (internship, new grad / entry, senior and above, from the title), country and remote (from the location, using the same place lists as `lib/location.ts`), company and posting date (`lib/filters.ts`). Filters are URL params applied as SQL `where` clauses in every search path; each one is a whole-word pattern built from one word list into both a Postgres regex and a JS `RegExp`, so the unit tests cover the SQL too (checked equal on every ingested job). The MCP `search_jobs` tool takes the same filters.
- `/jobs` ranks by fit to your profile by default when you have one ("Best fit for you", with a toggle back to newest or most relevant). With no query it orders every open job by the best evidence available: jobs the model scored 40+ first, then unscored jobs by embedding closeness to your profile, then jobs already judged poor. With a query, that fit order joins keyword and semantic results as a third list in the same rank fusion.
- `/jobs/[id]` shows the full posting (parsed into paragraphs and lists by `lib/text.ts`), your match score, reason and skill tags, the company brief summary, and Track and Apply. Job titles across the app open it.
- Ingest clears a job's embedding only when the text it was built from (title, description, company, location) changed, so the embed step re-embeds just those.
- The worker runs a daily refresh (`lib/refresh.ts`) on a pg-boss cron schedule: ingest (`lib/ingest.ts`), embed (`lib/embed-jobs.ts`), then one scoring job per user with a profile on the same per-user queue as the button, so it streams progress and never doubles up. The schedule uses pg-boss's `missed: "once"`, so a run missed while the machine slept happens once on wake. `/matches` then shows how many scores are new since your last visit, marked from the browser so a link prefetch doesn't count as a visit.
- `/matches` ("For you") embeds the profile (cached in `profile_embeddings`, keyed by a hash of the model and the profile text, so it re-embeds only after an edit), takes the 30 nearest open jobs, and scores them (`lib/match.ts`). A local LLM (`qwen2.5:7b`) returns JSON through Ollama's structured output: a score, role fit, the posting's minimum years, a quote of its location rule, and matched and missing skills. Code then decides what the model gets wrong: seniority from the years; the location rule, accepted only if the posting really has a rule sentence naming that place (`lib/location.ts`); skill tags with perks and traits removed (`lib/skills.ts`); and caps on the score from all three. On the labeled eval this took AUC from 0.84 to 0.91 and stated location rules caught from 5/9 to 9/9, with no false positives ([evals/match](evals/match/README.md)). Scores are deleted when the profile changes.
- Scoring runs off the request: "Score with AI" queues a [pg-boss](https://github.com/timgit/pg-boss) job on the same Postgres (`lib/queue.ts`), at most one queued or active per user. `npm run worker` (`scripts/worker.mts`) scores the unscored jobs one by one and sends a Postgres `NOTIFY` after each. `/api/progress` listens and forwards the user's own scoring progress (and research progress, which everyone watching a company sees) as server-sent events, and the page refreshes the list as each score lands. No polling, and no extra service.
- `/company/[board]` researches a company on the same worker: headless Chromium (Playwright) reads its home page plus up to three same-site About, Engineering or Culture pages (`lib/research.ts`), and the local model writes a brief (`lib/dossier.ts`). Only sites from the curated list in `lib/companies.ts` are ever crawled, never a URL a user typed. Any page but the home page can fail without sinking the run. Product and tech names are kept only if the pages contain them: on PostHog's site the model listed 8 technologies, and none appeared on the pages it read. One brief per company, shared by all users and reused for a week; progress streams to everyone watching that company.
- `/tracker` is a board of the jobs you track (Saved, Applied, Interviewing, Offer, Rejected). Cards move by drag and drop or a status menu (the keyboard-accessible path), and move instantly with React's `useOptimistic` while the server action saves. Every action checks the signed-in user and validates the job id and status. Jobs a board stops listing stay on your board, marked "No longer listed".
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, every migration against an empty pgvector Postgres, and a production build on each push.

## Roadmap

- [x] Postgres + Drizzle migrations, Docker Compose
- [x] Greenhouse / Lever / Ashby ingest, full-text search
- [x] Auth (Better Auth: email/password + optional GitHub), profile, resume upload
- [x] Resume fills in the profile; jobs ranked by fit to your resume; job detail page
- [x] Local embeddings (Ollama) + pgvector hybrid search
- [x] Local LLM match scoring (Ollama) with code-enforced gates, and a labeled eval set
- [ ] Bring-your-own-key providers (OpenAI / Anthropic) and recorded replies for demo mode
- [x] Background scoring worker (pg-boss) with live progress over SSE (Postgres LISTEN/NOTIFY)
- [x] Daily ingest → embed → score on a schedule, with "new since your last visit"
- [x] Playwright company research as a worker job, with code-checked product and tech names
- [x] Application tracker (drag and drop, optimistic updates)
- [x] CI: lint, typecheck, tests, migrations, build
- [x] MCP server: search, matches, tracker and company briefs as tools for Claude
- [ ] Tailored resume
- [x] Demo mode: PGlite snapshot + recorded model output, deployable free on Vercel
- [ ] Video
