import Link from "next/link";
import { DEMO } from "@/lib/demo";
import { getUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";
import { buttonClass } from "./ui";

export async function UserMenu() {
  const user = await getUser();
  if (!user) return <Link href="/login" className={buttonClass("secondary", "sm")}>Sign in</Link>;
  return (
    <span className="flex items-center gap-1">
      <span className="hidden max-w-40 truncate text-muted sm:inline">{user.name}</span>
      {!DEMO && <SignOutButton />}
    </span>
  );
}
