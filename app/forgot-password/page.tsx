import type { Metadata } from "next";
import Link from "next/link";
import { mailEnabled } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { linkClass, PageHeader } from "../ui";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16 sm:py-24">
      <PageHeader title="Reset your password" description="We'll email you a link to set a new one." />
      {DEMO || !mailEnabled ? (
        <p className="mt-6 text-sm">
          Password reset isn&apos;t set up on this server: it needs an email sender (<code>SMTP_URL</code>).{" "}
          <Link href="/login" className={linkClass}>Back to sign in</Link>
        </p>
      ) : (
        <ForgotForm />
      )}
    </main>
  );
}
