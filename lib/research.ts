export type Link = { href: string; text: string };

// Pages worth reading for a company brief, best first: who they are, how they build, how they work.
const PRIORITY = [/about|our[ -]story|mission|who-we-are|company/i, /engineering|blog|tech/i, /careers|culture|values|life-at|team/i];
const SKIP = /log-?in|sign-?in|sign-?up|register|privacy|legal|terms|cookie|\.(pdf|png|jpe?g|svg|zip)$/i;

const site = (u: URL) => u.hostname.replace(/^www\./, "");

// Chooses up to `max` same-site links from the home page to follow.
export function pickLinks(home: string, links: Link[], max: number): string[] {
  const homeUrl = new URL(home);
  const seen = new Set<string>();
  const ranked: { url: string; rank: number }[] = [];
  for (const { href, text } of links) {
    let u: URL;
    try {
      u = new URL(href, home);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || site(u) !== site(homeUrl)) continue;
    u.hash = "";
    const path = u.pathname.replace(/\/$/, "");
    const key = `${site(u)}${path}`;
    if (!path || SKIP.test(path) || seen.has(key)) continue;
    const rank = PRIORITY.findIndex((re) => re.test(path) || re.test(text));
    if (rank === -1) continue;
    seen.add(key);
    ranked.push({ url: u.toString(), rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map((r) => r.url);
}

export type Page = { url: string; text: string };

const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

// Reads the home page plus up to three linked pages. Only the home page is required;
// any other page that fails costs that page, not the run.
// shortcut: ignores robots.txt; it reads at most 4 pages of a curated site a week. Honor it before crawling arbitrary sites.
export async function crawl(home: string, onStep: (step: string) => Promise<unknown>): Promise<Page[]> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: "ShortlistResearch/0.1 (self-hosted job search)" });
    const read = async (url: string) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      const main = page.locator("main").first();
      const text = (await main.count()) ? await main.innerText() : await page.locator("body").innerText();
      return clean(text).slice(0, 2500);
    };

    await onStep(`Reading ${new URL(home).hostname}`);
    const pages: Page[] = [{ url: home, text: await read(home) }];
    const links = await page.$$eval("a[href]", (as) =>
      as.map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() ?? "" })),
    );
    for (const url of pickLinks(home, links, 3)) {
      try {
        await onStep(`Reading ${new URL(url).pathname}`);
        pages.push({ url, text: await read(url) });
      } catch (e) {
        console.error(`research: skipped ${url}`, e instanceof Error ? e.message : e);
      }
    }
    return pages.filter((p) => p.text.length > 200); // drop cookie walls and empty shells
  } finally {
    await browser.close();
  }
}
