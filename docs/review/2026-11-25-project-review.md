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
- [x] **Where:** `scripts/worker.mts`, `lib/queue.ts`, `scripts/ingest.mts`, `scripts/embed.mts`, `lib/scoring.ts`
- **Problem:** Ingest, embedding and scoring are all manual (`npm run ingest`, `npm run embed`, the "Score with AI" button). Jobs go stale unless someone runs them.
- **Fix:** Move the ingest and embed logic into `lib/` functions the scripts and the worker both call. Use pg-boss `boss.schedule` for a daily ingest → embed → score of new candidates for each user with a profile. Then show "N new matches since your last visit" on `/matches` (needs a `lastSeenAt` per user or a `createdAt` comparison). An email digest over the user's own SMTP could come later, optionally.
- **Done when:** with only `npm run dev` and `npm run worker` running, new jobs appear and get scored without manual commands.
- **Done:** `lib/ingest.ts` (`ingestAll`, now also counts new jobs) and `lib/embed-jobs.ts` (`embedPending`), called by the scripts and by `lib/refresh.ts`. The worker schedules `refresh-jobs` with `boss.schedule` at `REFRESH_CRON` (default `0 6 * * *`, in the machine's time zone; `off` unschedules) and `missed: "once"`, so a laptop asleep at 06:00 runs once on wake. Scoring reuses the per-user `score-matches` queue (live progress, no double runs, only unscored top candidates). "N new since your last visit" uses a separate `matches_seen` table (migration 0008, same demo-snapshot reason as 3.3), written by a client component on mount so link prefetches don't count, and re-marked as scores land. Also added `heartbeatSeconds: 30` to all queues (`updateQueue`, so existing installs get it): a worker killed mid-job used to leave the job `active`, and under the `exclusive` policy blocking new runs, until expiry (up to 3 h for refresh); now the next worker start releases and retries it in about a minute. Verified: a manual refresh (33/33 boards, 126 new jobs, 436 embedded, scoring queued for 2 users), the cron firing on its own, a second ingest clearing 0 embeddings, the new-since-last-visit flow across three visits, a hard-killed refresh released and completed about 80 s after restart, and demo mode unchanged. Email digest not done.

### 2.2 Search filters
- [x] **Where:** `app/jobs/page.tsx`, `lib/search.ts`
- **Problem:** No filters for remote, country, company, date posted or level (intern/new grad).
- **Fix:** Add filters as URL search params, applied as `where` clauses in all three search paths (fit, recent, hybrid). `lib/location.ts` already maps places to countries, so reuse it (maybe store a derived `country` / `remote` column at ingest). Level can come from title keywords (intern, new grad, senior, staff).
- **Done:** No stored `country` / `remote` / level columns (a new `jobs` column would break the demo snapshot, and need a backfill): `lib/filters.ts` (unit-tested) turns each filter into a whole-word pattern over the title or location, generated from one word list as both a Postgres regex and a JS `RegExp`. Over all open jobs the two agree exactly for every level, remote and all 15 countries. Applied in `lib/search.ts` to the fit, recent, keyword and semantic paths; checked that every returned row satisfies the filters on all four paths. `/jobs` has GET selects (works without JS; empty fields are redirected away so URLs stay clean), pagination and sort links keep filters, "Clear filters" resets them. The MCP `search_jobs` tool takes the same filters and now allows an empty query. In demo mode "posted within" counts back from the snapshot's newest posting, so it doesn't decay to zero as the frozen snapshot ages. Country coverage is limited to the 15 countries `lib/location.ts` knows.

### 2.3 Score one job on demand
- [x] **Where:** `app/jobs/[id]/page.tsx:89-93`, `lib/scoring.ts`, `lib/queue.ts`
- **Problem:** The job page says "Not scored for you yet" with no way to score it; only the 30 nearest jobs on `/matches` get scored.
- **Fix:** Add a "Score this job" button that queues a single-job scoring run (new queue or a `jobId` field on `ScoreJob`) and streams progress like `ScoreButton` does.
- **Done:** `ScoreJob` takes an optional `jobId`; `scoreOne` (`lib/scoring.ts`, integration-tested) scores and stores that job, skips the model if it's already scored, and tags progress events with the `jobId`. Its `singletonKey` is `user:job`, so it never collides with a full run. "Score this job" on the job page streams progress and refreshes the page when the score lands; `/matches`' button ignores single-job events. Checked end to end with Ollama: queued with no worker, then started the worker; the page updated itself with the score.

### 2.4 A fuller tracker
- [x] **Where:** `db/schema.ts` (`applications`), `app/tracker/`
- **Fix:** Add notes, applied date and next step / follow-up date (with a new migration via `npm run db:generate`). Show overdue follow-ups. Update the MCP `track_job` / `list_tracker` tools to match.
- **Done:** A separate `application_details` table (migration 0009) keyed by user and job, not new `applications` columns, so the demo snapshot keeps working and notes survive Remove → Undo. Applied date, next step, follow-up date, notes; `parseDetails` and `followUpDue` are unit-tested (offers and rejections never nag), and the actions are integration-tested (only your own card, bad dates rejected, applied date set on the first move to Applied and never overwriting one you set). Overdue follow-ups use the browser's date (`useSyncExternalStore`, so no hydration mismatch when the server runs in UTC). Demo shows the form read-only. MCP `track_job` takes the fields (left-out fields stay as they are) and `list_tracker` returns them; checked through a real MCP client.

### 2.5 Feedback: hide and rate jobs
- [x] **Where:** new table, `lib/search.ts` (`fitOrder`), `lib/candidates.ts`
- **Fix:** "Not interested" hides a job from `/jobs` and `/matches`. Thumbs up/down on a score, stored with the score, can be exported as labeled pairs for `evals/match`.
- **Done:** `job_feedback` table (migration 0010; a new table so the demo snapshot is untouched) with `hidden`, `rating` and `ratedScore`, the score as it was when rated, since scores are deleted on profile edits. `notHiddenFor()` (`lib/feedback.ts`) is applied in every search path and in `topCandidates`, so a hidden job also drops out of scoring and the next candidate moves up. `searchJobs` now takes an options object (`fit`, `filters`, `viewer`). "Not interested" collapses the row to "Hidden · Undo"; thumbs on `/matches` and the job page. `npm run eval:feedback` exports rated pairs in `pairs.json` format to `evals/match/feedback.local.json`, git-ignored because it contains the user's profile and resume; merging into the eval stays a manual, reviewed step. Integration-tested (all search paths, other users unaffected, rating needs a score and survives score deletion) and checked in the browser, including the export. Controls are hidden in demo mode.

### 2.6 Open roadmap items
- [ ] **Tailored resume / cover letter:** build from the profile, the job's matched and missing skills, and the company brief. Ground it like `groundDossier` does: never claim a skill the resume doesn't contain.
- [ ] **Bring-your-own-key providers:** `lib/llm.ts:6` marks the place for an `LLM_PROVIDER` switch (OpenAI / Anthropic), and `lib/embed.ts` needs the same. Keep Ollama the default.

### 2.7 More job sources
- [x] **Where:** `lib/boards.ts`, `lib/companies.ts`
- **Fix:** Add parsers for SmartRecruiters, Workable and Recruitee (public posting APIs, no key). Add more Indian companies. Consider moving the company list to a config file so adding a company doesn't need a code change (keep the curated `site` list that research is limited to).
- **Done:** Parsers for SmartRecruiters (pages through the list, then reads each posting's detail five at a time, since the list has no descriptions), Workable and Recruitee, unit-tested on fixtures shaped like the live responses. The list moved to `config/companies.json`, validated at startup by `lib/companies.ts` (known source, safe slug, https site, unique boards). Probed ~60 candidate slugs live and added the 12 with open roles: Druva, Rubrik, Paytm, Atlan, Composio, Plane, Perplexity, Cohere, ElevenLabs, Freshworks, Hugging Face, bunq (6 Indian). Skipped Bosch (5,178) and ServiceNow (972) on SmartRecruiters: one detail request per posting would make the daily run thousands of requests. Live ingest: 45/45 boards, 1,048 new jobs in 41 s, clean descriptions, locations and dates; embedded in 58 s. 8,268 open jobs.

### 2.8 Accounts
- [x] **Password reset:** Better Auth supports it but needs an email sender, so make it optional (SMTP env vars) and hide the link when unset. **Done:** `lib/mail.ts` (nodemailer, approved by the owner) sends over any `SMTP_URL`; `SMTP_URL=log` prints to the server console for a local install. `/forgot-password` gives the same answer whether or not the account exists (the email isn't awaited, so timing doesn't tell either); `/reset-password` sets the new password and handles expired or used links. `revokeSessionsOnPasswordReset` signs out other devices. Tested in a browser with `log` (mismatch, success, old password 401, new 200, other device signed out, reused link rejected, unknown email not mailed) and over real SMTP against a local test server (headers and link intact). Link hidden and pages explain when `SMTP_URL` is unset, and in demo mode.
- [x] **Delete my data:** delete the resume text, the profile and the account. Cascades already exist on `user.id`. **Done:** "Delete your account" on `/profile`: type your email to confirm; the action signs out, then deletes the user row, and profile, resume text, cached embedding, scores, tracker, `matches_seen` and sessions all cascade. Integration test checks every row of that user is gone and another user's are untouched; checked in the browser too. Disabled in demo mode.
- [x] **Restrict sign-up on self-hosted instances:** sign-up is open to anyone, so a public instance lets strangers queue LLM and Playwright jobs on your machine. Add `ALLOW_SIGNUP=0` and/or an `ALLOWED_EMAILS` list. **Done:** `lib/signup.ts` (unit-tested): `ALLOW_SIGNUP=0` closes sign-up, `ALLOWED_EMAILS` (emails or `@domain`) makes it invite-only, open when both are unset. Enforced in Better Auth's `databaseHooks.user.create.before`, so GitHub sign-in can't create accounts around it; the login page hides "Create an account" when closed. Checked against a running server: strangers get a 403 with the reason, invited emails and existing users still get in.

---

## 3. Engineering improvements

### 3.1 Integration tests on PGlite
- [x] **Where:** new `*.test.ts` alongside `lib/search.ts`, `scripts/ingest.mts` (after moving its logic to `lib/`), the server actions
- **Problem:** Unit tests cover the pure functions only. Search, the ingest logic that closes and reopens jobs, re-embed-on-change, and the auth/ownership checks in server actions have no tests.
- **Fix:** PGlite is already a dependency: in vitest, start PGlite with the vector extension, run `migrate()` from `drizzle-orm/pglite/migrator` (as `scripts/build-demo.mts` does), and test against it. No Docker needed.
- **Done:** `test/db.ts` boots PGlite with pgvector, runs `migrate()` on `db/migrations`, and each integration test file swaps it in with `vi.mock("@/db", () => import("@/test/db"))`, so `lib/` and `app/` code runs unchanged; only the network (board fetches), Ollama (`embed`) and request APIs (session, cookies) are mocked. 19 tests in 5 files: search (recent, filters, keyword fallback, semantic cutoff, fit order), ingest (new-job count, close/reopen keeping embeddings, re-embed only on embedded-text change, no closing on fetch failure, `embedPending`), the profile-embedding cache, tracker actions (ownership across users, undo, errors), and demo-mode tracker isolation across two visitors. Whole suite (101 tests) runs in ~2.5 s. Mutation-checked: reverting the re-embed comparison or the semantic cutoff makes them fail. Added `vitest.config.mts` (tsconfig paths).

### 3.2 Smoke-test demo mode in CI
- [x] **Where:** `.github/workflows/ci.yml`
- **Fix:** After `npm run build`, start the app with `DEMO_MODE=1` and use Playwright (already installed) to load `/`, `/jobs`, `/jobs?q=frontend internship in India`, `/matches`, `/tracker` and a company page with a brief, failing on console errors. This is the page recruiters see.
- **Done:** `scripts/smoke.mts` (`npm run smoke -- <url>`, uses the existing `playwright` dependency): loads `/`, `/jobs`, a demo search (asserting it is still "keyword + semantic", i.e. the recorded embeddings match), a filtered list, `/matches`, `/tracker`, `/company/vercel` (brief), `/profile`, a missing job and a real job page from the list; fails on non-2xx, any console or page error, missing content, or a missing demo banner. CI installs the Chromium headless shell, builds with `DEMO_MODE=1`, serves on :3100 and runs it. Passed 3/3 locally; a deliberately broken base URL fails all 10 checks with exit 1. Not yet run on GitHub Actions itself.

### 3.3 Cache the profile embedding
- [x] **Where:** `lib/candidates.ts:19`, `app/jobs/page.tsx:37`, `app/matches/page.tsx`, `app/profile/actions.ts`
- **Problem:** `/jobs` and `/matches` re-embed the profile through Ollama on every page load, including each pagination click, with up to a 10s timeout.
- **Fix:** Add a `profiles.embedding vector(768)` column, computed when the profile or resume is saved (or lazily on first use and cleared on save). Demo mode can read it from the snapshot instead of `demo/embeddings.json`.
- **Done:** Used a separate `profile_embeddings` table (migration 0007) instead of a `profiles.embedding` column: a new `profiles` column would break demo mode until the 16 MB snapshot was rebuilt (see 3.5), because `select().from(profiles)` reads every column. The row is keyed by sha256(embed model + `profileQuery` text), so any profile edit, prompt-format change or model switch misses the cache and re-embeds once; no save path has to clear it. It is filled lazily on first use and cascades on user delete. Demo mode keeps its recorded embeddings (already instant), so the snapshot is unchanged. Measured: `profileVector` went from ~85 ms warm (660 ms cold) to 1–2 ms, and cached pages no longer need Ollama for fit ranking.

### 3.4 Package the whole app
- [x] **Where:** `docker-compose.yml`, new `Dockerfile`
- **Problem:** Compose only runs Postgres, and the README setup takes nine commands. If the worker isn't running, the UI shows "Queued, waiting for the worker…" forever.
- **Fix:** Add a Dockerfile and `app`, `worker` and optional `ollama` services, so `docker compose up` is the whole setup. In the UI, if a queued job hasn't started after ~30s, say the worker may not be running.
- **Partly done (with 2.3):** both scoring buttons now say "Still waiting. Is the worker running?" when a queued job hasn't started after 30 s (`app/use-worker-hint.ts`; seen in the browser). 
- **Done:** `Dockerfile` with `app` and `worker` targets (the worker adds Chromium for research); compose runs `db`, a one-shot `migrate`, `app` and `worker`, with an optional `ollama` profile (plus a model pull) for Linux, and defaults to the host's Ollama since Docker on macOS has no GPU. The npm scripts now use `--env-file-if-exists`, so they run without a `.env` in a container. On an empty database the worker queues the first refresh itself. Tested as an isolated compose project from an empty volume: migrations ran, the worker ingested and embedded 7,224 jobs in 8.5 min, and in the browser hybrid search, single-job scoring and a company brief (Chromium in the worker image) all worked. Daily runs follow the container's `TZ` (UTC unless set; documented). Images are large (app 1.5 GB, worker 2.4 GB) because the worker runs TypeScript via tsx with dev dependencies; a standalone Next build and a compiled worker would shrink them. Dev setup is now `docker compose up -d --wait db`.

### 3.5 Get the demo snapshot out of git history
- [ ] **Where:** `demo/pgdata.tar.gz` (16 MB)
- **Problem:** Every snapshot refresh adds another 16 MB binary to git history.
- **Fix:** Git LFS, or publish the snapshot as a GitHub Release asset and download it at build time. Check that Vercel's build still finds it (`next.config.ts` `outputFileTracingIncludes`).

### 3.6 Smaller items
- [x] Resume profile extraction runs the LLM inside the server action (~30s, `app/profile/actions.ts:63-72`). Move it to the worker like scoring and research, with progress over `/api/progress`. **Done:** upload saves the extracted text and queues `fill-profile` (one per user); `fillProfileFromResume` (`lib/profile.ts`, integration-tested: fills only empty fields, adds only skills in the text, leaves scores alone when nothing changed) runs on the worker and sends a `profile` progress event; the form shows "Reading your resume…" then "Filled in …" and reloads its fields, with the 30 s worker hint. Upload went from ~30 s to 0.3 s in the browser test with a real generated PDF.
- [x] Persist the last scoring and research run status. Today a failure is only an SSE event, lost on refresh. pg-boss's job table already has the state. **Done:** `lastRun()` (`lib/run-status.ts`) reads the newest job for a key through pg-boss `findJobs` (no direct table queries); `toRunStatus` and `timeAgo` are unit-tested. `/matches` shows "last scored 2 hours ago", a queued/in-progress run, or the failure and its cause (full runs only, not single-job scores); company pages show a failed or running research run. Checked by making the worker's embedding model not exist: a fresh tab after the retry also failed showed "The last scoring run failed just now: … model 'no-such-embed-model' not found".
- [x] Wrap `getUser` in React `cache()` (`lib/session.ts:11`): `UserMenu` and each page look up the session separately on every request. **Done:** `getUser` is `cache()`d, so the layout and page share one session lookup per request.
- [x] Keep the postgres.js client on `globalThis` like `lib/queue.ts` does (`db/index.ts:14`), so dev hot reload doesn't leak connection pools. **Done:** connections stayed at 2 across 5 dev hot reloads.
- [x] Ingest only clears the embedding when the title or description changes, but `jobDocument` (`lib/embed.ts:36-39`) also includes company and location. Include location in the comparison at `scripts/ingest.mts:29`. **Done in 2.1:** the comparison now covers title, description, company and location (`is not distinct from`, since location can be null); a back-to-back second ingest cleared 0 embeddings.

---

## 4. Portfolio polish

- [x] Per-page titles: `generateMetadata` on `app/jobs/[id]/page.tsx` ("<title> at <company> · Shortlist") and `app/company/[board]/page.tsx`, plus static titles on the other pages. **Done:** title template `%s · Shortlist`; static titles on every page; `generateMetadata` gives "<title> at <company>" on job pages and "<name>: open roles and company brief" on company pages, with "not found" titles for bad ids.
- [x] An OpenGraph image (`app/opengraph-image.tsx`) so LinkedIn and other link previews look right. **Done:** static 1200×630 image built at build time (company count, eval AUC, $0), default font so the build needs no network; `metadataBase` comes from `BETTER_AUTH_URL`, else Next's Vercel URL fallback.
- [ ] A 60–90s demo GIF or video in the README (the "Video" roadmap item).
- [x] The home page hardcodes "AUC 0.91" (`app/page.tsx:47`); read it from `evals/match/results/latest.json`. **Done:** `lib/eval-summary.ts` computes the lenient AUC from `latest.json` with `evals/metrics.ts` at build time (reproduces 0.91); the OG image uses it too.
- [x] Tidy up: tick the finished checkboxes in `docs/superpowers/plans/2026-11-25-redesign.md` (the redesign shipped in `d35fe26`), and remove the leftover `/* config options here */` in `next.config.ts`. **Done:** 18 plan steps ticked after checking each shipped; two noted where the code differs from the plan (GitHub link in the footer, `/?q=` redirect in `next.config.ts`). Config comment removed.

---

## Suggested order

1. Bugs 1.1–1.3 and 1.5 (each is small).
2. 3.3 cache the profile embedding (speeds up every page and makes 2.1 cheaper).
3. 2.1 scheduled ingest and scoring.
4. 2.2 search filters.
5. 3.1 and 3.2 tests, before the bigger feature work.
6. Everything else as wanted.
