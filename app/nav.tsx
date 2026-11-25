"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/jobs", label: "Jobs" },
  { href: "/matches", label: "For you" },
  { href: "/tracker", label: "Tracker" },
  { href: "/profile", label: "Profile" },
] as const;

export function Nav() {
  return <NavLinks pathname={usePathname()} />;
}

// Rendered without a pathname as the Suspense fallback, so the links are in the static shell.
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname != null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 items-center rounded-md px-2.5 whitespace-nowrap transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
