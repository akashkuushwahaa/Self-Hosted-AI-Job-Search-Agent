import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { DEMO } from "@/lib/demo";
import { Nav, NavLinks } from "./nav";
import { linkClass, REPO_URL } from "./ui";
import { UserMenu } from "./user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute URLs for the link-preview image. Self-hosted: the public URL auth already needs.
  // Unset (the Vercel demo): Next uses the Vercel deployment URL.
  metadataBase: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : undefined,
  title: { default: "Shortlist · self-hosted AI job search", template: "%s · Shortlist" },
  description: "Self-hosted AI job search: hybrid search over public career boards, local-LLM match scoring, company research and an application tracker. No paid APIs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {DEMO && (
          <p className="border-b border-border bg-subtle px-4 py-1.5 text-center text-xs text-muted">
            Live demo with recorded data, signed in as a fictional candidate.{" "}
            <a href={REPO_URL} className={linkClass}>Run it yourself</a> for live scoring and research.
          </p>
        )}
        <header className="border-b border-border">
          <nav className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 text-sm" aria-label="Main">
            <Link href="/" className="shrink-0 rounded-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-accent">
              Shortlist
            </Link>
            <div className="min-w-0 flex-1 overflow-x-auto p-1">
              <Suspense fallback={<NavLinks pathname={null} />}>
                <Nav />
              </Suspense>
            </div>
            <div className="shrink-0">
              <Suspense>
                <UserMenu />
              </Suspense>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted">
            <span>Shortlist · self-hosted AI job search</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Source on GitHub ↗</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
