import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companyResearch, jobs, matches, tailoredApplications } from "@/db/schema";
import { getProfile } from "./candidates";
import { CHAT_MODEL, generateJson } from "./llm";
import { notify } from "./progress";
import { mentions } from "./skills";

// A summary, resume points and a cover letter for one job, written by the local model from the
// candidate's own resume. The model drafts; code decides what may stay (groundTailored): a point
// must quote its evidence from the resume (and the quote must name any skill the point names), and no
// sentence may claim a skill the posting asks for
// that the candidate's resume and profile don't show.

export const tailoredDraftSchema = z.object({
  jobSkills: z.array(z.string()).max(30), // the skills and tools the posting asks for
  summary: z.string(),
  highlights: z.array(z.object({ point: z.string(), evidence: z.string() })).max(6),
  coverLetter: z.string(),
});
export type TailoredDraft = z.infer<typeof tailoredDraftSchema>;
export type Tailored = Omit<TailoredDraft, "jobSkills"> & { removed: string[] };

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sentences = (paragraph: string) => paragraph.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

export function groundTailored(d: TailoredDraft, facts: { resumeText: string; profileSkills: string[] }): Tailored {
  const has = (skill: string) =>
    mentions(facts.resumeText, skill) || facts.profileSkills.some((s) => s.toLowerCase() === skill.trim().toLowerCase());
  const lacking = d.jobSkills.map((s) => s.trim()).filter((s) => s && !has(s));
  const claimsLacking = (text: string) => lacking.some((s) => mentions(text, s));
  const removed: string[] = [];
  const keep = (text: string) => (claimsLacking(text) ? (removed.push(text.trim()), false) : true);
  // Keeps paragraphs, drops only the offending sentences.
  const clean = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((p) => sentences(p.trim()).filter(keep).join(" "))
      .filter(Boolean)
      .join("\n\n");

  const summary = clean(d.summary);
  const resume = squash(facts.resumeText);
  // Any skill a point names must also be in its own quote: a real quote about React doesn't back
  // "Proficiency in Python".
  const skills = [...new Set([...d.jobSkills, ...facts.profileSkills].map((x) => x.trim()).filter(Boolean))];
  const backed = (h: { point: string; evidence: string }) => skills.every((sk) => !mentions(h.point, sk) || mentions(h.evidence, sk));
  const highlights = d.highlights.filter((h) => {
    const ok = h.evidence.trim() !== "" && resume.includes(squash(h.evidence)) && !claimsLacking(h.point) && backed(h);
    if (!ok) removed.push(h.point.trim());
    return ok;
  });
  return { summary, highlights, coverLetter: clean(d.coverLetter), removed };
}

type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

export function tailorPrompt(
  p: Profile,
  job: { title: string; company: string; description: string },
  extra: { matched?: string[]; missing?: string[]; brief?: string | null },
) {
  const system = `You help a job seeker apply to one job. Write only from the candidate's resume and profile below.
Rules:
- Never claim a skill, tool, employer, degree, title or number that the resume or profile doesn't state.
- If the job asks for something the candidate lacks, leave it out. Don't say they have it.
- jobSkills: the skills and tools the posting asks for, as short names ("React", "Kubernetes").
- summary: 2-3 sentences for the top of the resume, aimed at this job.
- highlights: up to 6 resume points that matter most for this job, each rewritten for this job, with "evidence": an exact quote from the resume that supports it.
- coverLetter: 3 short paragraphs, plain and specific, no greeting or sign-off, no clichés like "I am writing to express".`;
  const user = `CANDIDATE
Headline: ${p.headline ?? "-"}
Location: ${p.location ?? "-"}
Years of experience: ${p.yearsExperience ?? "-"}
Skills: ${p.skills.join(", ") || "-"}
Target roles: ${p.targetRoles.join(", ") || "-"}
Resume:
${(p.resumeText ?? "").slice(0, 6000)}

JOB: ${job.title} at ${job.company}
${extra.matched?.length ? `Skills the candidate matches: ${extra.matched.join(", ")}\n` : ""}${extra.missing?.length ? `Skills the candidate lacks (don't claim these): ${extra.missing.join(", ")}\n` : ""}${extra.brief ? `About the company: ${extra.brief}\n` : ""}Posting:
${job.description.slice(0, 5000)}`;
  return { system, user };
}

// Worker job: draft, ground, store, and tell the job page.
export async function tailorApplication(userId: string, jobId: string) {
  const progress = (state: "running" | "finished" | "failed") => notify({ kind: "tailor", userId, jobId, state });
  try {
    await progress("running");
    const profile = await getProfile(userId);
    if (!profile?.resumeText) throw new Error("upload a resume first");
    const [job] = await db.select({ title: jobs.title, company: jobs.company, board: jobs.board, description: jobs.description }).from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error(`no job ${jobId}`);
    const [[match], [brief]] = await Promise.all([
      db.select({ matched: matches.matchedSkills, missing: matches.missingSkills }).from(matches).where(and(eq(matches.userId, userId), eq(matches.jobId, jobId))),
      db.select({ dossier: companyResearch.dossier }).from(companyResearch).where(eq(companyResearch.board, job.board)),
    ]);
    const { system, user } = tailorPrompt(profile, job, { matched: match?.matched, missing: match?.missing, brief: brief?.dossier.summary });
    const tailored = groundTailored(await generateJson(tailoredDraftSchema, system, user), {
      resumeText: profile.resumeText,
      profileSkills: profile.skills,
    });
    const values = { content: tailored, model: CHAT_MODEL, createdAt: new Date() };
    await db
      .insert(tailoredApplications)
      .values({ userId, jobId, ...values })
      .onConflictDoUpdate({ target: [tailoredApplications.userId, tailoredApplications.jobId], set: values });
    await progress("finished");
    return tailored;
  } catch (e) {
    await progress("failed");
    throw e;
  }
}
