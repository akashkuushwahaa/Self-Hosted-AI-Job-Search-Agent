import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/auth-schema";
import { mayCreateAccount, signupPolicy } from "./signup";

const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;

export const githubEnabled = Boolean(github);
export const signup = signupPolicy();

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
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
