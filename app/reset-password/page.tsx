import type { Metadata } from "next";
import { Suspense } from "react";
import { Muted, PageHeader } from "../ui";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16 sm:py-24">
      <PageHeader title="Set a new password" description="You'll be signed out on your other devices." />
      {/* The token arrives in the URL from the emailed link; reading it is request-time. */}
      <Suspense fallback={<Muted className="mt-6">Loading…</Muted>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
