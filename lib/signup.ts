// Who may create an account. Sign-up is open by default (a local, single-user install), but a
// public instance would let strangers queue LLM and Playwright work on your machine, so:
//   ALLOW_SIGNUP=0                    no new accounts
//   ALLOWED_EMAILS=me@x.com,@team.dev only these emails, or any email at these domains
// Enforced in lib/auth.ts on user creation, which covers email sign-up and GitHub sign-in alike.

type Env = Record<string, string | undefined>;
export type SignupPolicy = { mode: "open" | "closed" | "invite"; allowed: string[] };

export function signupPolicy(env: Env = process.env): SignupPolicy {
  const allowed = (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length) return { mode: "invite", allowed };
  return { mode: ["0", "false", "no", "off"].includes((env.ALLOW_SIGNUP ?? "").trim().toLowerCase()) ? "closed" : "open", allowed };
}

export function mayCreateAccount(email: string, policy: SignupPolicy): boolean {
  if (policy.mode !== "invite") return policy.mode === "open";
  const e = email.trim().toLowerCase();
  return policy.allowed.some((entry) => (entry.startsWith("@") ? e.endsWith(entry) : e === entry));
}
