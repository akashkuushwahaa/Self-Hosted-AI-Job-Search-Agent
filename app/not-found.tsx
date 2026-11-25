import Link from "next/link";
import { buttonClass, PageHeader } from "./ui";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageHeader title="Not found" description="That page or job doesn't exist. Jobs disappear when a company takes the posting down." />
      <div className="mt-6 flex items-center gap-2">
        <Link href="/jobs" className={buttonClass()}>Browse jobs</Link>
        <Link href="/" className={buttonClass("secondary")}>Home</Link>
      </div>
    </main>
  );
}
