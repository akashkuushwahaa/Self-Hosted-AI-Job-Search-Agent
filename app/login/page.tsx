import type { Metadata } from "next";
import Link from "next/link";
import { githubEnabled, signup } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { linkClass, PageHeader } from "../ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16 sm:py-24">
      <PageHeader title="Sign in to Shortlist" description="Your profile, matches and tracker stay on this server." />
      {DEMO ? (
        <p className="mt-6">
          The demo signs everyone in as a fictional candidate. Go to <Link href="/matches" className={linkClass}>For you</Link>.
        </p>
      ) : (
        <LoginForm githubEnabled={githubEnabled} signup={signup.mode} />
      )}
    </main>
  );
}
