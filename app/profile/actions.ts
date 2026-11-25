"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { matches, profiles } from "@/db/schema";
import { DEMO } from "@/lib/demo";
import { extractResumeText, ResumeError } from "@/lib/resume";
import { extractProfile, mergeExtracted } from "@/lib/resume-profile";
import { requireUser } from "@/lib/session";

export type FormState = { ok?: string; error?: string } | null;

// Editing would delete the recorded match scores, which the demo cannot recompute.
const DEMO_READ_ONLY = "The demo profile is read-only: changing it would discard the recorded match scores.";

const list = (max: number) =>
  z
    .string()
    .max(4000)
    .transform((s) => [...new Set(s.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, max));

const profileSchema = z.object({
  headline: z.string().trim().max(120).transform((s) => s || null),
  location: z.string().trim().max(120).transform((s) => s || null),
  yearsExperience: z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0, "Years must be 0 or more").max(60, "Years must be 60 or less"),
  ]),
  skills: list(100),
  targetRoles: list(20),
});

async function upsertProfile(userId: string, values: Partial<typeof profiles.$inferInsert>) {
  await db.transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values });
    await tx.delete(matches).where(eq(matches.userId, userId)); // scores were for the old profile
  });
}

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  if (DEMO) return { error: DEMO_READ_ONLY };
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await upsertProfile(user.id, parsed.data);
  return { ok: "Profile saved" };
}

export async function uploadResume(_: FormState, form: FormData): Promise<FormState> {
  if (DEMO) return { error: DEMO_READ_ONLY };
  const user = await requireUser();
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF to upload" };
  try {
    const text = await extractResumeText(new Uint8Array(await file.arrayBuffer()));
    let values = {};
    let note = "";
    if (form.get("fill") === "on") {
      try {
        const [current] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
        const merged = mergeExtracted(current ?? null, await extractProfile(text), text);
        values = merged.values;
        note = merged.filled.length ? ` Filled in ${merged.filled.join(", ")}.` : " Your profile already had everything it found.";
      } catch (e) {
        console.error("profile extraction failed", e); // the resume is still worth saving
        note = " Couldn't fill in your profile: the local model isn't responding.";
      }
    }
    await upsertProfile(user.id, { resumeText: text.slice(0, 50_000), resumeFileName: file.name.slice(0, 200), ...values });
    refresh();
    return { ok: `Read ${file.name}.${note}` };
  } catch (e) {
    if (e instanceof ResumeError) return { error: e.message };
    throw e;
  }
}
