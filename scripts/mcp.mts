// MCP server over stdio, so Claude Code / Claude Desktop can use Shortlist as tools.
// Runs locally as one user (SHORTLIST_USER_EMAIL). Stdout is the protocol: log only to stderr.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { client, db } from "../db";
import { user } from "../db/auth-schema"; // star re-exports from schema.ts aren't visible to ESM scripts under tsx
import { applicationDetails, applications, companyResearch, jobs, matches, profiles } from "../db/schema";
import { companies, companyByBoard } from "../lib/companies";
import { COUNTRY_OPTIONS, filterParams, LEVELS, type Level } from "../lib/filters";
import { splitSkills } from "../lib/skills";
import { cleanReason } from "../lib/text";
import { searchJobs } from "../lib/search";
import { STATUSES } from "../lib/tracker";

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

async function currentUserId() {
  const email = process.env.SHORTLIST_USER_EMAIL;
  if (!email) return null;
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  return row?.id ?? null;
}
// Everything a model needs about a job; leaves out the 768-number embedding.
const jobColumns = {
  id: jobs.id, title: jobs.title, company: jobs.company, board: jobs.board, location: jobs.location,
  url: jobs.url, description: jobs.description, postedAt: jobs.postedAt, closedAt: jobs.closedAt,
};

const NO_USER = "Set SHORTLIST_USER_EMAIL to the email you sign in to Shortlist with.";

const server = new McpServer({ name: "shortlist", version: "0.1.0" });

server.registerTool(
  "search_jobs",
  {
    description:
      "Search open jobs from company career boards. Combines keyword and semantic search; supports quotes and -exclusions. " +
      "Optional filters narrow by level (from the title), country or remote (from the location), company board and posting age. " +
      "Leave query empty to list the newest jobs matching the filters.",
    inputSchema: {
      query: z.string().max(200).default(""),
      limit: z.number().int().min(1).max(25).default(10),
      level: z.enum(Object.keys(LEVELS) as [Level, ...Level[]]).optional().describe("intern, entry (new grad / junior) or senior (senior and above)"),
      country: z.enum(COUNTRY_OPTIONS.map((c) => c.code) as [string, ...string[]]).optional().describe("ISO country code"),
      remote: z.boolean().optional(),
      company: z.enum(companies.map((c) => c.board) as [string, ...string[]]).optional().describe("Company board id, as in job results"),
      postedWithinDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query, limit, level, country, remote, company, postedWithinDays }) => {
    const filters = { remote: remote ?? false, country: country ?? null, company: company ?? null, postedDays: postedWithinDays ?? null, level: level ?? null };
    const { rows, total, more, mode } = await searchJobs(query.trim(), 1, limit, null, filters);
    return json({ mode, total, moreMayMatch: more, filters: filterParams(filters), jobs: rows });
  },
);

server.registerTool(
  "get_job",
  {
    description: "Full posting for one job id from search_jobs, list_matches or list_tracker.",
    inputSchema: { job_id: z.uuid() },
    annotations: { readOnlyHint: true },
  },
  async ({ job_id }) => {
    const [job] = await db.select(jobColumns).from(jobs).where(eq(jobs.id, job_id));
    if (!job) return fail("No job with that id.");
    return json({ ...job, description: job.description.slice(0, 8000), open: job.closedAt == null });
  },
);

server.registerTool(
  "list_matches",
  {
    description: "Your AI-scored job matches (0-100), best first, with the reason and matched/missing skills.",
    inputSchema: { min_score: z.number().int().min(0).max(100).default(0) },
    annotations: { readOnlyHint: true },
  },
  async ({ min_score }) => {
    const userId = await currentUserId();
    if (!userId) return fail(NO_USER);
    const rows = await db
      .select({
        jobId: jobs.id, title: jobs.title, company: jobs.company, location: jobs.location, url: jobs.url,
        score: matches.score, reason: matches.reason, matchedSkills: matches.matchedSkills, missingSkills: matches.missingSkills,
      })
      .from(matches)
      .innerJoin(jobs, eq(jobs.id, matches.jobId))
      .where(eq(matches.userId, userId))
      .orderBy(desc(matches.score))
      .limit(50);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const candidate = profile ?? { skills: [], resumeText: null };
    return json(
      rows
        .filter((r) => r.score >= min_score)
        .map((r) => {
          const skills = splitSkills(r.matchedSkills, r.missingSkills, candidate);
          return { ...r, reason: cleanReason(r.reason), matchedSkills: skills.matched, missingSkills: skills.missing };
        }),
    );
  },
);

server.registerTool(
  "list_tracker",
  {
    description: `Your application tracker: tracked jobs, their status (${STATUSES.join(", ")}), and your applied date, next step, follow-up date and notes.`,
    annotations: { readOnlyHint: true },
  },
  async () => {
    const userId = await currentUserId();
    if (!userId) return fail(NO_USER);
    const rows = await db
      .select({
        jobId: jobs.id, title: jobs.title, company: jobs.company, url: jobs.url, status: applications.status, closed: jobs.closedAt,
        appliedOn: applicationDetails.appliedOn, nextStep: applicationDetails.nextStep, followUpOn: applicationDetails.followUpOn, notes: applicationDetails.notes,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .leftJoin(applicationDetails, and(eq(applicationDetails.userId, applications.userId), eq(applicationDetails.jobId, applications.jobId)))
      .where(eq(applications.userId, userId));
    return json(rows.map(({ closed, ...r }) => ({ ...r, stillListed: closed == null })));
  },
);

server.registerTool(
  "track_job",
  {
    description:
      "Add a job to your tracker, or set its status if it is already there. Optionally set the applied date, next step, " +
      "follow-up date (YYYY-MM-DD) or notes; fields left out keep their current value.",
    inputSchema: {
      job_id: z.uuid(),
      status: z.enum(STATUSES).default("saved"),
      applied_on: z.iso.date().optional(),
      next_step: z.string().max(200).optional(),
      follow_up_on: z.iso.date().optional(),
      notes: z.string().max(5000).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ job_id, status, applied_on, next_step, follow_up_on, notes }) => {
    const userId = await currentUserId();
    if (!userId) return fail(NO_USER);
    const [job] = await db.select({ title: jobs.title, company: jobs.company }).from(jobs).where(eq(jobs.id, job_id));
    if (!job) return fail("No job with that id.");
    await db
      .insert(applications)
      .values({ userId, jobId: job_id, status })
      .onConflictDoUpdate({ target: [applications.userId, applications.jobId], set: { status } });
    const details = Object.fromEntries(
      Object.entries({ appliedOn: applied_on, nextStep: next_step, followUpOn: follow_up_on, notes }).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(details).length) {
      await db
        .insert(applicationDetails)
        .values({ userId, jobId: job_id, ...details })
        .onConflictDoUpdate({ target: [applicationDetails.userId, applicationDetails.jobId], set: details });
    }
    return json({ tracked: `${job.title} at ${job.company}`, status, ...details });
  },
);

server.registerTool(
  "company_brief",
  {
    description: "Research brief for a company, written from its own website (summary, products, culture, interview talking points).",
    inputSchema: { board: z.enum(companies.map((c) => c.board) as [string, ...string[]]).describe("Company board slug, e.g. vercel") },
    annotations: { readOnlyHint: true },
  },
  async ({ board }) => {
    const company = companyByBoard(board)!;
    const [row] = await db.select().from(companyResearch).where(eq(companyResearch.board, board));
    if (!row) return fail(`No brief for ${company.name} yet. Research it from its page in the Shortlist app.`);
    return json({ company: company.name, site: company.site, researchedAt: row.researchedAt, sources: row.sources, ...row.dossier });
  },
);

const transport = new StdioServerTransport();
server.server.onclose = () => void client.end(); // let the process exit when the client disconnects
await server.connect(transport);
console.error("shortlist MCP server ready on stdio");
