import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { auth } from "./auth";
import { DEMO, DEMO_USER_ID } from "./demo";

// cache(): the layout's UserMenu and the page both ask for the user; one session lookup per request.
export const getUser = cache(async () => {
  const requestHeaders = await headers();
  // PGlite (demo mode) runs in-process, so without this its queries would run during prerendering.
  await connection();
  if (DEMO) {
    // Everyone is the fictional demo candidate; there is no sign-in to break.
    const [demoUser] = await db.select().from(user).where(eq(user.id, DEMO_USER_ID));
    return demoUser ?? null;
  }
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
});

// Call at the top of every protected page and server action: actions are public endpoints.
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
