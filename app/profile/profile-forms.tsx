"use client";

import { useActionState } from "react";
import type { profiles } from "@/db/schema";
import { buttonClass, errorClass, inputClass as input, labelClass } from "../ui";
import { deleteAccount, saveProfile, uploadResume, type FormState } from "./actions";

const button = buttonClass();

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p role="alert" className={errorClass}>{state.error}</p>;
  if (state?.ok) return <p role="status" className="text-sm text-accent">{state.ok}</p>;
  return null;
}

type Props = { name: string; email: string; profile: typeof profiles.$inferSelect | null };

export function ProfileForms({ name, email, profile }: Props) {
  const [saveState, save, saving] = useActionState(saveProfile, null);
  const [uploadState, upload, uploading] = useActionState(uploadResume, null);
  const [deleteState, remove, deleting] = useActionState(deleteAccount, null);

  return (
    <div className="mt-8 max-w-2xl space-y-10">
      <p className="text-sm text-muted">{name} · {email}</p>

      {/* keyed on updatedAt so the inputs pick up values a resume upload just filled in */}
      <form key={profile?.updatedAt.toISOString()} action={save} className="space-y-4">
        <div>
          <label htmlFor="headline" className={labelClass}>Headline</label>
          <input id="headline" name="headline" defaultValue={profile?.headline ?? ""} placeholder="Full-stack engineer, AI/LLM apps" className={input} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className={labelClass}>Location</label>
            <input id="location" name="location" defaultValue={profile?.location ?? ""} placeholder="Ahmedabad, India" className={input} />
          </div>
          <div>
            <label htmlFor="yearsExperience" className={labelClass}>Years of experience</label>
            <input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} defaultValue={profile?.yearsExperience ?? ""} className={input} />
          </div>
        </div>
        <div>
          <label htmlFor="skills" className={labelClass}>Skills (comma separated)</label>
          <textarea id="skills" name="skills" rows={3} defaultValue={profile?.skills.join(", ")} placeholder="TypeScript, Next.js, Python, PostgreSQL" className={input} />
        </div>
        <div>
          <label htmlFor="targetRoles" className={labelClass}>Roles you want (comma separated)</label>
          <input id="targetRoles" name="targetRoles" defaultValue={profile?.targetRoles.join(", ")} placeholder="Software Engineer Intern, AI Engineer" className={input} />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={saving} className={button}>{saving ? "Saving…" : "Save profile"}</button>
          <Status state={saveState} />
        </div>
      </form>

      <form action={upload} className="space-y-3 border-t border-border pt-8">
        <h2 className="font-medium">Resume</h2>
        <p className="text-sm text-muted">
          {profile?.resumeFileName ? `Current: ${profile.resumeFileName}.` : "No resume yet."}{" "}
          PDF, up to 5 MB. Only the text is stored.
        </p>
        <label htmlFor="resume" className="sr-only">Resume PDF</label>
        <input id="resume" name="resume" type="file" accept="application/pdf" required className="block w-full text-sm text-muted file:mr-3 file:h-9 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-subtle" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="fill" defaultChecked className="size-4 accent-accent" />
          Fill in my profile from it (empty fields only; adds skills it finds)
        </label>
        <div className="flex items-center gap-3">
          <button disabled={uploading} className={button}>{uploading ? "Reading your resume… (about 30s)" : "Upload"}</button>
          <Status state={uploadState} />
        </div>
      </form>

      <form action={remove} className="space-y-3 border-t border-border pt-8">
        <h2 className="font-medium">Delete your account</h2>
        <p className="text-sm text-muted">
          Deletes your account, resume text, profile, match scores and tracker from this server. This can&apos;t be undone.
        </p>
        <label htmlFor="confirm" className={labelClass}>Type <span className="font-mono">{email}</span> to confirm</label>
        <input id="confirm" name="confirm" autoComplete="off" spellCheck={false} className={input} />
        <div className="flex items-center gap-3">
          <button disabled={deleting} className={`${buttonClass("secondary")} text-red-700 dark:text-red-400`}>
            {deleting ? "Deleting…" : "Delete my account and data"}
          </button>
          <Status state={deleteState} />
        </div>
      </form>
    </div>
  );
}
