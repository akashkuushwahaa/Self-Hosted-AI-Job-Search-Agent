// Records the README's demo video: a captioned walkthrough of demo mode with a visible cursor.
//   DEMO_MODE=1 npm run build && DEMO_MODE=1 npm start -- -p 3100   (in another terminal)
//   node scripts/record-demo.mjs [base-url] [out-dir]               → a .webm in out-dir
// Then encode: ffmpeg -ss 0.4 -i <file>.webm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -an docs/media/shortlist-demo.mp4
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? "docs/media/raw";
const W = 1280, H = 800;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } });

// Caption bar and a visible cursor, kept across page loads via sessionStorage.
await ctx.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__cap")) return;
    const cap = document.createElement("div");
    cap.id = "__cap";
    Object.assign(cap.style, {
      position: "fixed", left: "50%", bottom: "26px", transform: "translateX(-50%)", maxWidth: "1040px", width: "max-content",
      padding: "12px 22px", background: "rgba(17,24,39,.93)", color: "#fff", font: "500 19px/1.45 system-ui,-apple-system,Segoe UI,sans-serif",
      borderRadius: "12px", zIndex: 2147483646, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.25)", transition: "opacity .35s",
    });
    cap.textContent = sessionStorage.getItem("__cap") || "";
    cap.style.opacity = cap.textContent ? "1" : "0";
    document.body.appendChild(cap);
    const dot = document.createElement("div");
    dot.id = "__cur";
    Object.assign(dot.style, {
      position: "fixed", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(4,120,87,.5)", border: "2px solid #fff",
      boxShadow: "0 0 0 1px rgba(0,0,0,.35)", pointerEvents: "none", zIndex: 2147483647, transform: "translate(-50%,-50%)", transition: "transform .12s",
      left: (sessionStorage.getItem("__x") || -40) + "px", top: (sessionStorage.getItem("__y") || -40) + "px",
    });
    document.body.appendChild(dot);
    addEventListener("mousemove", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; sessionStorage.setItem("__x", e.clientX); sessionStorage.setItem("__y", e.clientY); }, true);
    // Native drag-and-drop sends drag events, not mouse moves: follow those too.
    addEventListener("dragover", (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; sessionStorage.setItem("__x", e.clientX); sessionStorage.setItem("__y", e.clientY); }, true);
    addEventListener("mousedown", () => (dot.style.transform = "translate(-50%,-50%) scale(.65)"), true);
    addEventListener("mouseup", () => (dot.style.transform = "translate(-50%,-50%)"), true);
  };
  if (document.readyState === "complete") install(); else addEventListener("load", install);
});

const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const caption = (text) => page.evaluate((t) => {
  sessionStorage.setItem("__cap", t);
  const c = document.getElementById("__cap");
  if (c) { c.textContent = t; c.style.opacity = t ? "1" : "0"; }
}, text);
let cx = W / 2, cy = H / 2;
const moveTo = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  cx = b.x + Math.min(b.width / 2, 60); cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy, { steps: 28 });
};
const click = async (locator) => { await moveTo(locator); await wait(250); await page.mouse.down(); await wait(90); await page.mouse.up(); };
const scroll = async (dy, steps = 12) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await wait(45); } };
const settle = async () => { await page.waitForLoadState("networkidle"); await wait(300); };

// 1. Home
await page.goto(BASE + "/"); await settle();
await page.mouse.move(cx, cy);
await caption("Shortlist: a self-hosted AI job search agent. Local models, no paid APIs, $0 to run.");
await wait(4200);
await scroll(330); await wait(2600);

// 2. Search
await caption("Live jobs from companies' public career boards, ranked by fit to your profile");
await click(page.getByRole("link", { name: "Jobs", exact: true }).first()); await settle();
await wait(3000);
await click(page.locator("#q"));
await page.keyboard.type("frontend internship in India", { delay: 75 });
await wait(400); await page.keyboard.press("Enter"); await settle();
await caption("Hybrid search: Postgres full-text + pgvector semantic search, merged by rank fusion");
await moveTo(page.locator("main p.tabular-nums").first()); await wait(4500);

// 3. Filters
await moveTo(page.locator("#filter-level")); await page.selectOption("#filter-level", "intern"); await wait(500);
await moveTo(page.locator("#filter-country")); await page.selectOption("#filter-country", "IN"); await wait(500);
await caption("Filters for level, country, remote, company and posting date, applied in SQL");
await wait(800);
await click(page.getByRole("button", { name: "Apply" })); await settle(); await wait(3000);

// 4. For you
await caption("For you: the 30 jobs nearest your profile, scored by a local LLM, best fit first");
await click(page.getByRole("link", { name: "For you", exact: true }).first()); await settle();
await wait(3400);
await caption("Jobs the candidate can't take (too senior, wrong country) are capped low, with the reason");
await scroll(2600, 30); await wait(3600); await scroll(-2600, 20); await wait(700);

// 5. A scored job
await caption("Every score explains itself. Code enforces seniority and location rules the model gets wrong.");
await click(page.locator("main ul li a.font-medium").first()); await settle();
await wait(2200);
await moveTo(page.getByText("Your match", { exact: false }).first()); await scroll(180); await wait(4200);

// 6. Company brief
await caption("Company briefs: a headless browser reads the company's own site; claims not on its pages are dropped");
await page.goto(BASE + "/company/vercel"); await settle();
await wait(2600); await scroll(500, 14); await wait(3000);

// 7. Tracker
await caption("Application tracker: drag cards between columns (with notes and follow-up reminders)");
await click(page.getByRole("link", { name: "Tracker", exact: true }).first()); await settle();
await wait(2200);
const card = page.locator('section[aria-label="Saved"] li').first();
const target = page.locator('section[aria-label="Interviewing"]');
await moveTo(card.locator("a.font-medium"));
const tb = await target.boundingBox();
await page.mouse.down();
await page.mouse.move(tb.x + tb.width / 2, tb.y + 140, { steps: 40 });
await page.mouse.up();
await wait(3000);

// 8. End card
await caption("");
await page.evaluate(() => {
  const el = document.createElement("div");
  Object.assign(el.style, { position: "fixed", inset: "0", background: "#fff", zIndex: 2147483645, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", font: "500 20px/1.5 system-ui,-apple-system,sans-serif", color: "#111827", opacity: "0", transition: "opacity .6s" });
  el.innerHTML = `<div style="display:flex;align-items:center;gap:14px"><div style="width:22px;height:22px;border-radius:6px;background:#047857"></div><div style="font-size:44px;font-weight:650;letter-spacing:-1px">Shortlist</div></div>
  <div style="color:#4b5563">Self-hosted AI job search · daily job refresh · tailored resume points · MCP tools for Claude</div>
  <div style="color:#4b5563">Next.js · PostgreSQL + pgvector · Ollama · pg-boss · Playwright</div>
  <div style="margin-top:12px;color:#047857;font-weight:600">shortlist-five-virid.vercel.app</div>
  <div style="color:#6b7280">github.com/akashkuushwahaa/Self-Hosted-AI-Job-Search-Agent</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
});
await wait(5200);

const video = page.video();
await ctx.close();
console.log("video:", await video.path());
await browser.close();
