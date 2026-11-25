# Project review: 2026-11-25

A full read of the codebase (`lib/`, `app/`, `scripts/`, `db/`, CI, README) to find bugs, missing features and improvements. Written for a later Claude session to pick items up and make the changes.

State at review time: commit `a16a668`. Lint, typecheck and all 62 unit tests pass. `npm audit` shows 4 moderate issues, all in drizzle-kit's dev tooling (`@esbuild-kit/esm-loader`), so nothing that ships.

## Ground rules for whoever picks this up

- Keep every dependency self-hosted or free forever: no paid APIs, no free-tier keys that expire.
- Any change to match scoring (`lib/match.ts`, `lib/location.ts`, `lib/skills.ts`, prompts) must be measured with `npm run eval:match` before it ships. Record the result in `evals/match/results/`.
- Demo mode (`DEMO_MODE=1`, PGlite snapshot) must keep working. Check any change against it.
- Read `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`): this is Next 16, so APIs differ from older versions.
- Commit only when the user asks, and never add Claude attribution or a Co-Authored-By line.
- Tick the box when an item is done, and note anything that changed from the suggested fix.

---

## 1. Bugs (fix first)

### 1.1 Search always reports at least 100 matches
- [x] **Where:** `lib/search.ts:57-58` (semantic list), `:75` (`total: ranked.length`)
- **Problem:** The semantic query returns the 100 nearest jobs with no similarity cutoff. Any query, even "pastry chef", reports 100+ matches and fills the pages with unrelated jobs. The total shown is really the size of the merged candidate lists, not the number of relevant jobs.
- **Fix:** Drop semantic results past a cosine-distance cutoff (pick it from real queries; try what separates "frontend internship in India" hits from noise). Consider showing "about N results" or dropping the count for hybrid mode.
- **Done when:** a nonsense query returns few or no semantic results, and the five `DEMO_QUERIES` still return good results.
- **Done:** Semantic hits are kept only when cosine distance < min(0.40, best + 0.08) (`lib/relevance.ts`, unit-tested). Measured on 18 queries: "asdf qwerty", "truck driver" and "nurse" now return 0 semantic hits, "pastry chef" 1; the demo queries keep 13–100 (e.g. "frontend internship in India" 39, "backend engineer bangalore" 39). The keyword list is still capped at 100, so a capped total shows as "N+" (and `moreMayMatch` in the MCP `search_jobs` result) instead of adding a count query.

### 1.2 Demo visitors share one tracker
- [x] **Where:** `app/tracker/actions.ts`, `lib/session.ts:15-19`, `db/index.ts` (demo PGlite on `globalThis`)
- **Problem:** Every demo visitor is the same user, and the tracker actions write to the shared in-memory database. One visitor removing cards changes the board for everyone on that server instance, and on Vercel each instance holds a different state.
- **Fix:** In demo mode, keep tracker changes per visitor, either in a cookie (a small map of jobId → status layered over the snapshot) or client-side in localStorage. The server snapshot stays read-only.
- **Done when:** two browsers on the demo have independent trackers.
- **Done:** Went with the cookie overlay: `lib/demo-tracker.ts` (unit-tested) holds up to 50 [jobId, status | null] changes per visitor, zod-validated on read. `lib/applications.ts` `userApplications` layers it over the snapshot, and the tracker page, job page and Track buttons all read through it; the demo never writes `applications`. Checked with two Playwright browser contexts on a `DEMO_MODE=1` build.

### 1.3 Research progress leaks other users' IDs
- [x] **Where:** `app/api/progress/route.ts:22`, `lib/research-run.ts:12-13`, `lib/progress.ts`
- **Problem:** Research events go to every signed-in user (on purpose, since briefs are shared), but each event carries the `userId` of whoever asked for the research.
- **Fix:** Leave `userId` out of research events (change the `Progress` type), or strip it in the route before sending.
- **Done:** Removed `userId` from research progress events (type, `researchCompany`, worker). `ResearchJob` still records who asked in pg-boss's own table, which no client sees.

### 1.4 No error boundaries; failures are silent
- [x] **Where:** `app/` (no `error.tsx`, `not-found.tsx` or `global-error.tsx`), `app/tracker/board.tsx:26-35`, `app/track-button.tsx`, `app/tracker/actions.ts`
- **Problem:** Server actions throw (`"No such job"`, zod parse errors), and with no error boundary the user gets Next's default error page. A failed tracker move rolls the optimistic card back with no message. "Remove" has no confirm or undo.
- **Fix:** Add `app/error.tsx` and `app/not-found.tsx` styled with `app/ui.tsx`. Have tracker actions return an error state the board shows. Add undo (a short toast) or a confirm to Remove.
- **Done:** Added `app/error.tsx`, `app/not-found.tsx` and also `app/global-error.tsx` (the root layout's `UserMenu` queries the DB, which `error.tsx` doesn't cover). Tracker actions return `{ error }` instead of throwing; the board shows it in a live region, and the Track button shows it inline. Remove has an Undo toast (6s) that re-tracks with the old status. The board now renders even when empty, or removing the last card would unmount it and lose the toast.

### 1.5 README names the wrong route
- [x] **Where:** `README.md:62`
- **Problem:** It says `/api/matches/events`, but the route is `/api/progress` (it carries research progress too).
- **Fix:** Update the sentence.
- **Done:** Also says research progress goes to everyone watching that company.

---

## 2. Missing features

### 2.1 Make it an agent: scheduled ingest, embed and score
- [ ] **Where:** `scripts/worker.mts`, `lib/queue.ts`, `scripts/ingest.mts`, `scripts/embed.mts`, `lib/scoring.ts`
- **Problem:** Ingest, embedding and scoring are all manual (`npm run ingest`, `npm run embed`, the "Score with AI" button). Jobs go stale unless someone runs them.
- **Fix:** Move the ingest and embed logic into `lib/` functions the scripts and the worker both call. Use pg-boss `boss.schedule` for a daily ingest → embed → score of new candidates for each user with a profile. Then show "N new matches since your last visit" on `/matches` (needs a `lastSeenAt` per user or a `createdAt` comparison). An email digest over the user's own SMTP could come later, optionally.
- **Done when:** with only `npm run dev` and `npm run worker` running, new jobs appear and get scored without manual commands.

### 2.2 Search filters
- [ ] **Where:** `app/jobs/page.tsx`, `lib/search.ts`
- **Problem:** No filters for remote, country, company, date posted or level (intern/new grad).
- **Fix:** Add filters as URL search params, applied as `where` clauses in all three search paths (fit, recent, hybrid). `lib/location.ts` already maps places to countries, so reuse it (maybe store a derived `country` / `remote` column at ingest). Level can come from title keywords (intern, new grad, senior, staff).

### 2.3 Score one job on demand
- [ ] **Where:** `app/jobs/[id]/page.tsx:89-93`, `lib/scoring.ts`, `lib/queue.ts`
- **Problem:** The job page says "Not scored for you yet" with no way to score it; only the 30 nearest jobs on `/matches` get scored.
- **Fix:** Add a "Score this job" button that queues a single-job scoring run (new queue or a `jobId` field on `ScoreJob`) and streams progress like `ScoreButton` does.

### 2.4 A fuller tracker
- [ ] **Where:** `db/schema.ts` (`applications`), `app/tracker/`
- **Fix:** Add notes, applied date and next step / follow-up date (with a new migration via `npm run db:generate`). Show overdue follow-ups. Update the MCP `track_job` / `list_tracker` tools to match.

### 2.5 Feedback: hide and rate jobs
- [ ] **Where:** new table, `lib/search.ts` (`fitOrder`), `lib/candidates.ts`
- **Fix:** "Not interested" hides a job from `/jobs` and `/matches`. Thumbs up/down on a score, stored with the score, can be exported as labeled pairs for `evals/match`.

### 2.6 Open roadmap items
- [ ] **Tailored resume / cover letter:** build from the profile, the job's matched and missing skills, and the company brief. Ground it like `groundDossier` does: never claim a skill the resume doesn't contain.
- [ ] **Bring-your-own-key providers:** `lib/llm.ts:6` marks the place for an `LLM_PROVIDER` switch (OpenAI / Anthropic), and `lib/embed.ts` needs the same. Keep Ollama the default.

### 2.7 More job sources
- [ ] **Where:** `lib/boards.ts`, `lib/companies.ts`
- **Fix:** Add parsers for SmartRecruiters, Workable and Recruitee (public posting APIs, no key). Add more Indian companies. Consider moving the company list to a config file so adding a company doesn't need a code change (keep the curated `site` list that research is limited to).

### 2.8 Accounts
- [ ] **Password reset:** Better Auth supports it but needs an email sender, so make it optional (SMTP env vars) and hide the link when unset.
- [ ] **Delete my data:** delete the resume text, the profile and the account. Cascades already exist on `user.id`.
- [ ] **Restrict sign-up on self-hosted instances:** sign-up is open to anyone, so a public instance lets strangers queue LLM and Playwright jobs on your machine. Add `ALLOW_SIGNUP=0` and/or an `ALLOWED_EMAILS` list.

---

## 3. Engineering improvements

### 3.1 Integration tests on PGlite
- [ ] **Where:** new `*.test.ts` alongside `lib/search.ts`, `scripts/ingest.mts` (after moving its logic to `lib/`), the server actions
- **Problem:** Unit tests cover the pure functions only. Search, the ingest logic that closes and reopens jobs, re-embed-on-change, and the auth/ownership checks in server actions have no tests.
- **Fix:** PGlite is already a dependency: in vitest, start PGlite with the vector extension, run `migrate()` from `drizzle-orm/pglite/migrator` (as `scripts/build-demo.mts` does), and test against it. No Docker needed.

### 3.2 Smoke-test demo mode in CI
- [ ] **Where:** `.github/workflows/ci.yml`
- **Fix:** After `npm run build`, start the app with `DEMO_MODE=1` and use Playwright (already installed) to load `/`, `/jobs`, `/jobs?q=frontend internship in India`, `/matches`, `/tracker` and a company page with a brief, failing on console errors. This is the page recruiters see.

### 3.3 Cache the profile embedding
- [x] **Where:** `lib/candidates.ts:19`, `app/jobs/page.tsx:37`, `app/matches/page.tsx`, `app/profile/actions.ts`
- **Problem:** `/jobs` and `/matches` re-embed the profile through Ollama on every page load, including each pagination click, with up to a 10s timeout.
- **Fix:** Add a `profiles.embedding vector(768)` column, computed when the profile or resume is saved (or lazily on first use and cleared on save). Demo mode can read it from the snapshot instead of `demo/embeddings.json`.
- **Done:** Used a separate `profile_embeddings` table (migration 0007) instead of a `profiles.embedding` column: a new `profiles` column would break demo mode until the 16 MB snapshot was rebuilt (see 3.5), because `select().from(profiles)` reads every column. The row is keyed by sha256(embed model + `profileQuery` text), so any profile edit, prompt-format change or model switch misses the cache and re-embeds once; no save path has to clear it. It is filled lazily on first use and cascades on user delete. Demo mode keeps its recorded embeddings (already instant), so the snapshot is unchanged. Measured: `profileVector` went from ~85 ms warm (660 ms cold) to 1–2 ms, and cached pages no longer need Ollama for fit ranking.

### 3.4 Package the whole app
- [ ] **Where:** `docker-compose.yml`, new `Dockerfile`
- **Problem:** Compose only runs Postgres, and the README setup takes nine commands. If the worker isn't running, the UI shows "Queued, waiting for the worker…" forever.
- **Fix:** Add a Dockerfile and `app`, `worker` and optional `ollama` services, so `docker compose up` is the whole setup. In the UI, if a queued job hasn't started after ~30s, say the worker may not be running.

### 3.5 Get the demo snapshot out of git history
- [ ] **Where:** `demo/pgdata.tar.gz` (16 MB)
- **Problem:** Every snapshot refresh adds another 16 MB binary to git history.
- **Fix:** Git LFS, or publish the snapshot as a GitHub Release asset and download it at build time. Check that Vercel's build still finds it (`next.config.ts` `outputFileTracingIncludes`).

### 3.6 Smaller items
- [ ] Resume profile extraction runs the LLM inside the server action (~30s, `app/profile/actions.ts:63-72`). Move it to the worker like scoring and research, with progress over `/api/progress`.
- [ ] Persist the last scoring and research run status. Today a failure is only an SSE event, lost on refresh. pg-boss's job table already has the state.
- [ ] Wrap `getUser` in React `cache()` (`lib/session.ts:11`): `UserMenu` and each page look up the session separately on every request.
- [ ] Keep the postgres.js client on `globalThis` like `lib/queue.ts` does (`db/index.ts:14`), so dev hot reload doesn't leak connection pools.
- [ ] Ingest only clears the embedding when the title or description changes, but `jobDocument` (`lib/embed.ts:36-39`) also includes company and location. Include location in the comparison at `scripts/ingest.mts:29`.

---

## 4. Portfolio polish

- [ ] Per-page titles: `generateMetadata` on `app/jobs/[id]/page.tsx` ("<title> at <company> · Shortlist") and `app/company/[board]/page.tsx`, plus static titles on the other pages.
- [ ] An OpenGraph image (`app/opengraph-image.tsx`) so LinkedIn and other link previews look right.
- [ ] A 60–90s demo GIF or video in the README (the "Video" roadmap item).
- [ ] The home page hardcodes "AUC 0.91" (`app/page.tsx:47`); read it from `evals/match/results/latest.json`.
- [ ] Tidy up: tick the finished checkboxes in `docs/superpowers/plans/2026-11-25-redesign.md` (the redesign shipped in `d35fe26`), and remove the leftover `/* config options here */` in `next.config.ts`.

---

## Suggested order

1. Bugs 1.1–1.3 and 1.5 (each is small).
2. 3.3 cache the profile embedding (speeds up every page and makes 2.1 cheaper).
3. 2.1 scheduled ingest and scoring.
4. 2.2 search filters.
5. 3.1 and 3.2 tests, before the bigger feature work.
6. Everything else as wanted.
