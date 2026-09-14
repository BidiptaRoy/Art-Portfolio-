"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ui } from "@/components/ui";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-20">
      <h1 className="font-display text-3xl tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-ink-soft">
        The design manager couldn&apos;t load this page. If you&apos;re still setting up the site,
        check that the SQL migration from the README has been run in Supabase.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={ui.buttonPrimary}>
          Try again
        </button>
        <Link href="/admin" className={ui.buttonSecondary}>
          Back to designs
        </Link>
      </div>
    </main>
  );
}
