import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/auth-schema";
import { mailEnabled, sendMail } from "./mail";
import { mayCreateAccount, signupPolicy } from "./signup";

const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;

export const githubEnabled = Boolean(github);
export const signup = signupPolicy();
export { mailEnabled };

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Signs out every other device once the password changes, in case the old one leaked.
    revokeSessionsOnPasswordReset: true,
    // Only with an email sender configured; the login page hides "Forgot password?" otherwise.
    ...(mailEnabled && {
      sendResetPassword: async ({ user, url }) => {
        // Not awaited: replying at the same speed whether or not the email exists doesn't reveal
        // which emails have accounts.
        void sendMail({
          to: user.email,
          subject: "Reset your Shortlist password",
          text: `Someone asked to reset the password for ${user.email} on Shortlist.\n\nSet a new one here (the link works for an hour):\n${url}\n\nIf it wasn't you, ignore this email; your password stays the same.`,
        }).catch((e) => console.error("password reset email failed", e));
      },
    }),
  },
  socialProviders: github ? { github } : {},
  plugins: [nextCookies()],
  databaseHooks: {
    user: {
      create: {
        // Every way of making an account (email sign-up, first GitHub sign-in) passes through here.
        before: async (user) => {
          if (!mayCreateAccount(user.email, signup)) {
            throw new APIError("FORBIDDEN", {
              message: signup.mode === "closed" ? "Sign-up is closed on this server." : "This email isn't invited to this server.",
            });
          }
        },
      },
    },
  },
});
