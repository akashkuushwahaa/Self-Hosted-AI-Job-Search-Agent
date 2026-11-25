"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { buttonClass, errorClass, inputClass as input, labelClass } from "../ui";

const button = `${buttonClass()} w-full`;

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const { error } =
      mode === "signUp"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) return setError(error.message ?? "Something went wrong");
    router.push(mode === "signUp" ? "/profile" : "/jobs");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-5">
      {githubEnabled && (
        <>
          <button
            type="button"
            className={`${buttonClass("secondary")} w-full`}
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/jobs" })}
          >
            Continue with GitHub
          </button>
          <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or</p>
        </>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signUp" && (
          <div>
            <label htmlFor="name" className={labelClass}>Name</label>
            <input id="name" name="name" required autoComplete="name" className={input} />
          </div>
        )}
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signUp" ? "new-password" : "current-password"}
            className={input}
          />
        </div>
        {error && <p role="alert" className={errorClass}>{error}</p>}
        <button disabled={pending} className={button}>
          {pending ? "…" : mode === "signUp" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        className={`${buttonClass("ghost")} w-full`}
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
