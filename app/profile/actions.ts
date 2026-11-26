"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { extractResumeText, ResumeError } from "@/lib/resume";
import { saveProfileValues } from "@/lib/profile";
import { getBoss, PROFILE_QUEUE } from "@/lib/queue";
import { requireUser } from "@/lib/session";

// queued: work handed to the worker, whose progress the page follows over /api/progress.
export type FormState = { ok?: string; error?: string; queued?: boolean } | null;

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

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  if (DEMO) return { error: DEMO_READ_ONLY };
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await saveProfileValues(user.id, parsed.data);
  return { ok: "Profile saved" };
}

export async function uploadResume(_: FormState, form: FormData): Promise<FormState> {
  if (DEMO) return { error: DEMO_READ_ONLY };
  const user = await requireUser();
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF to upload" };
  try {
    const text = await extractResumeText(new Uint8Array(await file.arrayBuffer()));
    await saveProfileValues(user.id, { resumeText: text.slice(0, 50_000), resumeFileName: file.name.slice(0, 200) });
    refresh();
    if (form.get("fill") !== "on") return { ok: `Read ${file.name}.` };
    // The model takes ~30 s, so it runs on the worker; the page follows its progress.
    const boss = await getBoss();
    await boss.send(PROFILE_QUEUE, { userId: user.id }, { singletonKey: user.id });
    return { ok: `Read ${file.name}. Filling in your profile from it…`, queued: true };
  } catch (e) {
    if (e instanceof ResumeError) return { error: e.message };
    throw e;
  }
}

// Deletes the account and everything stored for it: the resume text, profile, cached embedding,
// scores, tracker and sessions all cascade from the user row (db/schema.ts). Company briefs are
// shared by everyone and stay.
export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  if (DEMO) return { error: "The demo account can't be deleted." };
  const current = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== current.email.toLowerCase()) {
    return { error: "Type your email exactly to confirm." };
  }
  // Sign out first, so the browser's session cookie is cleared along with the session.
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  await db.delete(user).where(eq(user.id, current.id));
  redirect("/");
}
