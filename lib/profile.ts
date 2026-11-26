import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matches, profiles } from "@/db/schema";
import { getProfile } from "./candidates";
import { notify } from "./progress";
import { extractProfile, mergeExtracted } from "./resume-profile";

// Saves profile fields and drops the user's match scores, which were for the old profile.
export async function saveProfileValues(userId: string, values: Partial<typeof profiles.$inferInsert>) {
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values });
    await tx.delete(matches).where(eq(matches.userId, userId));
  });
}

// Worker job after a resume upload: the local model reads the stored resume text and fills the
// profile's empty fields (lib/resume-profile.ts decides what it may change). Runs off the request,
// since the model takes ~30 s; progress goes to the profile page over /api/progress.
export async function fillProfileFromResume(userId: string) {
  try {
    await notify({ kind: "profile", userId, state: "running" });
    const profile = await getProfile(userId);
    if (!profile?.resumeText) throw new Error("no resume to read");
    const { values, filled } = mergeExtracted(profile, await extractProfile(profile.resumeText), profile.resumeText);
    if (filled.length) await saveProfileValues(userId, values);
    await notify({ kind: "profile", userId, state: "finished", filled });
    return filled;
  } catch (e) {
    await notify({ kind: "profile", userId, state: "failed" });
    throw e;
  }
}
