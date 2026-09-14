import Link from "next/link";
import { signOut } from "./actions";

export function AdminHeader({ email }: { email: string | null }) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-display text-lg font-semibold tracking-tight">
            Design manager
          </Link>
          {email && (
            <span className="hidden text-xs text-ink-soft md:inline">
              Signed in as {email}
            </span>
          )}
        </div>
        <nav aria-label="Admin" className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            target="_blank"
            className="rounded-full px-3 py-2 transition hover:bg-paper"
          >
            View portfolio<span className="sr-only"> (opens in a new tab)</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full px-3 py-2 transition hover:bg-paper"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
