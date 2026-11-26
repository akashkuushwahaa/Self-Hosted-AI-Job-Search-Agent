"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonClass, errorClass, inputClass, labelClass, linkClass } from "../ui";

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"idle" | "saving" | "done" | { error: string }>("idle");

  // Better Auth sends expired or already-used links here with ?error=INVALID_TOKEN.
  if (!token || params.get("error")) {
    return (
      <p className="mt-6 text-sm">
        This reset link is invalid or has expired. <Link href="/forgot-password" className={linkClass}>Ask for a new one</Link>.
      </p>
    );
  }
  if (state === "done") {
    return (
      <p role="status" className="mt-6 text-sm">
        Your password is changed. <Link href="/login" className={linkClass}>Sign in</Link> with the new one.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) return setState({ error: "The two passwords don't match." });
    setState("saving");
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    setState(error ? { error: error.message ?? "Couldn't change the password. Ask for a new link." } : "done");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>Type it again</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </div>
      {typeof state === "object" && <p role="alert" className={errorClass}>{state.error}</p>}
      <button disabled={state === "saving"} className={`${buttonClass()} w-full`}>{state === "saving" ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
