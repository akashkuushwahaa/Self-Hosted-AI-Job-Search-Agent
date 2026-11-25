# Redesign + recruiter Home page — design

## Intent
Shortlist is a portfolio project; recruiters open the demo link from a resume. They need a Home page that says what it is and why it's impressive, and every page should look simple, minimal and consistent.

## Goals
- New public Home page at `/` aimed at recruiters.
- Consistent minimal look on every page: Jobs, For you, Tracker, Company, Profile, Sign in.

## Non-goals / anti-goals
- No data, query, auth or server-action logic changes.
- No new dependencies (no component kit). Heavy, decorated UI (shadows, gradients, cards everywhere) would be a failure.

## Approaches
- **A (picked): shared UI primitives + tokens on the existing Tailwind.** One `app/ui.tsx`-style file (button, input, tag, score badge, page header), tokens in `globals.css`. No new packages; pages can't drift.
- B: shadcn/ui — many deps, heavier look than wanted.
- C: restyle each page inline — fastest, repeats today's drift.

## Decided
- Home `/`: headline, one-paragraph pitch, "Try the live demo →" (→ `/matches`) + "View source ↗" (GitHub), stats row (open jobs + companies live from DB, 0.91 AUC and $0 static), 5-step "How it works", "Built with" stack line.
- Search moves to `/jobs`. Sign-in (email + GitHub callback) lands on `/jobs`; Tracker empty-state "search" link → `/jobs`; pagination/demo query links → `/jobs`.
- Look: monochrome + Geist, one accent for primary buttons and high scores, hairline borders, generous whitespace, dark mode kept. Same page header on every page, active nav link, slim neutral demo bar.

## Left to the builder (Claude's calls)
- Exact accent color, spacing scale, component API.
- Footer content (GitHub link only; no personal details).
