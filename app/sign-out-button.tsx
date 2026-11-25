"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { buttonClass } from "./ui";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
