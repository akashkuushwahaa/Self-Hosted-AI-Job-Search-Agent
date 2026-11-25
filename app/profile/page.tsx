import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Muted, PageHeader } from "../ui";
import { ProfileForms } from "./profile-forms";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader title="Profile" description="What matching uses: your skills, target roles and resume." />
      <Suspense fallback={<Muted className="mt-6">Loading profile…</Muted>}>
        <Profile />
      </Suspense>
    </main>
  );
}

async function Profile() {
  const user = await requireUser();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  return <ProfileForms name={user.name} email={user.email} profile={profile ?? null} />;
}
