import { db } from "@/db";
import { companyResearch } from "@/db/schema";
import { companyByBoard } from "./companies";
import { writeDossier } from "./dossier";
import { CHAT_MODEL } from "./llm";
import { notify } from "./progress";
import { crawl } from "./research";

// Crawls the company's own site, writes the brief, and stores it for every user.
export async function researchCompany(board: string, userId: string) {
  const company = companyByBoard(board);
  const step = (step: string, state: "running" | "finished" | "failed" = "running") =>
    notify({ kind: "research", userId, board, step, state });
  try {
    if (!company) throw new Error(`unknown company ${board}`);
    const pages = await crawl(company.site, step);
    if (!pages.length) throw new Error(`no readable pages on ${company.site}`);
    await step(`Writing the brief from ${pages.length} pages`);
    const dossier = await writeDossier(company.name, pages);
    const values = { dossier, sources: pages.map((p) => p.url), model: CHAT_MODEL, researchedAt: new Date() };
    await db.insert(companyResearch).values({ board, ...values }).onConflictDoUpdate({ target: companyResearch.board, set: values });
    await step("Done", "finished");
  } catch (e) {
    await step(e instanceof Error ? e.message : "Research failed", "failed");
    throw e;
  }
}
