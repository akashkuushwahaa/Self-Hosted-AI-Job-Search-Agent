"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonClass, errorClass, inputClass, labelClass, linkClass } from "../ui";

export function ForgotForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setState(error ? { error: error.message ?? "Something went wrong. Try again." } : "sent");
  }

  if (state === "sent") {
    // The same answer whether or not the account exists, so the form can't be used to find accounts.
    return (
      <p role="status" className="mt-6 text-sm">
        If an account uses that email, a reset link is on its way. It works for an hour.{" "}
        <Link href="/login" className={linkClass}>Back to sign in</Link>
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      {typeof state === "object" && <p role="alert" className={errorClass}>{state.error}</p>}
      <button disabled={state === "sending"} className={`${buttonClass()} w-full`}>
        {state === "sending" ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/login" className={`${buttonClass("ghost")} w-full`}>Back to sign in</Link>
    </form>
  );
}
