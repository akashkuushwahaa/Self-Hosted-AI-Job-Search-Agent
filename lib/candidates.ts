import { and, cosineDistance, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { jobs, matches, profileEmbeddings, profiles } from "@/db/schema";
import { DEMO } from "./demo";
import { EMBED_MODEL, embed } from "./embed";
import { profileQuery } from "./match";
import { splitSkills } from "./skills";
import { cleanReason } from "./text";

export const CANDIDATE_COUNT = 30;

export async function getProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return profile ?? null;
}

type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

// The profile (headline, roles, skills, resume) as one search vector. Cached per user and keyed
// on what was embedded, so it costs one Ollama call per profile change rather than one per page.
export async function profileVector(profile: Profile) {
  const text = profileQuery(profile);
  if (DEMO) return (await embed([text], "search_query"))[0]; // recorded, already instant
  const key = createHash("sha256").update(`${EMBED_MODEL}\n${text}`).digest("hex");
  const [cached] = await db
    .select({ embedding: profileEmbeddings.embedding })
    .from(profileEmbeddings)
    .where(and(eq(profileEmbeddings.userId, profile.userId), eq(profileEmbeddings.key, key)));
  if (cached) return cached.embedding;
  const [embedding] = await embed([text], "search_query", 10_000);
  await db
    .insert(profileEmbeddings)
    .values({ userId: profile.userId, key, embedding })
    .onConflictDoUpdate({ target: profileEmbeddings.userId, set: { key, embedding } });
  return embedding;
}

// Nearest open jobs to the profile by embedding, with this user's LLM score where one exists.
export async function topCandidates(userId: string, profile: Profile) {
  const v = await profileVector(profile);
  const distance = cosineDistance(jobs.embedding, v);
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      board: jobs.board,
      company: jobs.company,
      location: jobs.location,
      url: jobs.url,
      description: jobs.description,
      similarity: sql<number>`1 - (${distance})`,
      score: matches.score,
      scoredAt: matches.createdAt,
      reason: matches.reason,
      matchedSkills: matches.matchedSkills,
      missingSkills: matches.missingSkills,
    })
    .from(jobs)
    .leftJoin(matches, and(eq(matches.jobId, jobs.id), eq(matches.userId, userId)))
    .where(and(isNull(jobs.closedAt), isNotNull(jobs.embedding)))
    .orderBy(distance)
    .limit(CANDIDATE_COUNT);
  // Scored jobs first by score; unscored keep their similarity order behind them.
  // Tags are cleaned on read too, so stored scores pick up filter improvements without re-scoring.
  return rows
    .map((r) => {
      if (!r.matchedSkills || !r.missingSkills) return r;
      const skills = splitSkills(r.matchedSkills, r.missingSkills, profile);
      return { ...r, reason: r.reason && cleanReason(r.reason), matchedSkills: skills.matched, missingSkills: skills.missing };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
