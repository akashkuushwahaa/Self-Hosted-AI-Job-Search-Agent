// Smoke test for demo mode, the build recruiters see: loads each public page in headless Chromium
// and fails on a bad status, a console or page error, or missing content. Run against a DEMO_MODE=1
// server (CI does, after the build): `npm run smoke -- http://localhost:3100`.
import { chromium, type Page } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

type Check = { path: string; expect: (page: Page) => Promise<string | null> };

// Each check returns null when the page looks right, or what's wrong.
const text = (wanted: string | RegExp) => async (page: Page) =>
  (await page.locator("main").getByText(wanted).count()) ? null : `missing text ${wanted}`;
const listed = (min: number) => async (page: Page) => {
  const n = await page.locator("main ul li").count();
  return n >= min ? null : `expected at least ${min} list items, found ${n}`;
};
const all = (...checks: ((page: Page) => Promise<string | null>)[]) => async (page: Page) => {
  for (const check of checks) {
    const problem = await check(page);
    if (problem) return problem;
  }
  return null;
};

const checks: Check[] = [
  { path: "/", expect: text(/no paid APIs/i) },
  { path: "/jobs", expect: all(text(/best fit for your profile first/), listed(25)) },
  // Recorded query embeddings still match: semantic search runs, not the keyword-only fallback.
  { path: "/jobs?q=frontend internship in India", expect: all(text(/keyword \+ semantic/), listed(5)) },
  { path: "/jobs?level=intern&country=IN", expect: listed(1) },
  { path: "/matches", expect: all(text(/all scored/), listed(10)) },
  { path: "/tracker", expect: async (page) => ((await page.locator("section li").count()) ? null : "the demo board is empty") },
  { path: "/company/vercel", expect: text("Talking points for an interview") },
  {
    path: "/profile",
    expect: async (page) => ((await page.locator("#skills").count()) && (await page.locator("#skills").inputValue()) ? null : "the demo profile has no skills"),
  },
  { path: "/jobs/00000000-0000-4000-8000-000000000000", expect: text("Not found") },
  { path: "/forgot-password", expect: text(/isn't set up on this server/) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(10_000); // fail a check, not wait out Playwright's 30 s default
let errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

let failed = 0;
const visit = async (path: string, expect: Check["expect"]) => {
  errors = [];
  const response = await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  const problems = [
    !response?.ok() && `HTTP ${response?.status()}`,
    await expect(page).catch((e: Error) => `check threw: ${e.message.split("\n")[0]}`),
    // The banner is in the layout, so every page shows it in demo mode.
    !(await page.getByText("Live demo with recorded data").count()) && "no demo banner: is DEMO_MODE=1 set?",
    ...errors.map((e) => `console: ${e}`),
  ].filter(Boolean);
  console.log(`${problems.length ? "✗" : "✓"} ${path}${problems.map((p) => `\n    ${p}`).join("")}`);
  if (problems.length) failed++;
};

for (const { path, expect } of checks) await visit(path, expect);
// A real job page, reached the way a visitor would: from the list.
await page.goto(`${BASE}/jobs`);
await page.waitForLoadState("networkidle"); // the list streams in after the shell
const link = page.locator("main ul li a.font-medium").first();
const job = (await link.count()) ? await link.getAttribute("href") : null;
if (job) await visit(job, text(/Apply|No longer listed/));
else {
  failed++;
  console.log("✗ no job link on /jobs to open");
}

await browser.close();
console.log(failed ? `${failed} failed` : "all pages ok");
process.exit(failed ? 1 : 0);
