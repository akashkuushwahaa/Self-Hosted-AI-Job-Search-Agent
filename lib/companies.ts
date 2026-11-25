import type { Company, Source } from "./boards";

export type ListedCompany = Company & { site: string };

const list = (source: Source, rows: [board: string, name: string, site: string][]) =>
  rows.map(([board, name, site]) => ({ source, board, name, site }));

// Public career-board slugs (each checked live; a board that later 404s is skipped by ingest)
// and the company's own site, which research crawls. Research only ever visits these sites.
export const companies: ListedCompany[] = [
  ...list("greenhouse", [
    ["vercel", "Vercel", "https://vercel.com"],
    ["stripe", "Stripe", "https://stripe.com"],
    ["airbnb", "Airbnb", "https://news.airbnb.com"],
    ["databricks", "Databricks", "https://www.databricks.com"],
    ["cloudflare", "Cloudflare", "https://www.cloudflare.com"],
    ["figma", "Figma", "https://www.figma.com"],
    ["discord", "Discord", "https://discord.com"],
    ["gitlab", "GitLab", "https://about.gitlab.com"],
    ["mongodb", "MongoDB", "https://www.mongodb.com"],
    ["datadog", "Datadog", "https://www.datadoghq.com"],
    ["coinbase", "Coinbase", "https://www.coinbase.com"],
    ["anthropic", "Anthropic", "https://www.anthropic.com"],
    ["dropbox", "Dropbox", "https://www.dropbox.com"],
    ["pinterest", "Pinterest", "https://about.pinterest.com"],
    ["reddit", "Reddit", "https://redditinc.com"],
    ["twilio", "Twilio", "https://www.twilio.com"],
    ["elastic", "Elastic", "https://www.elastic.co"],
    ["razorpaysoftwareprivatelimited", "Razorpay", "https://razorpay.com"],
    ["groww", "Groww", "https://groww.in"],
    ["hackerrank", "HackerRank", "https://www.hackerrank.com"],
  ]),
  ...list("lever", [
    ["spotify", "Spotify", "https://newsroom.spotify.com"],
    ["cred", "CRED", "https://cred.club"],
    ["meesho", "Meesho", "https://www.meesho.io"],
    ["zeta", "Zeta", "https://www.zeta.tech"],
  ]),
  ...list("ashby", [
    ["linear", "Linear", "https://linear.app"],
    ["openai", "OpenAI", "https://openai.com"],
    ["notion", "Notion", "https://www.notion.com"],
    ["ramp", "Ramp", "https://ramp.com"],
    ["posthog", "PostHog", "https://posthog.com"],
    ["supabase", "Supabase", "https://supabase.com"],
    ["replit", "Replit", "https://replit.com"],
    ["cursor", "Cursor", "https://cursor.com"],
    ["sarvam", "Sarvam AI", "https://www.sarvam.ai"],
  ]),
];

export const companyByBoard = (board: string) => companies.find((c) => c.board === board);
