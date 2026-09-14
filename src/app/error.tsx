"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { ui } from "@/components/ui";

export default function Error({
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
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className={`${ui.eyebrow} text-accent`}>Something went wrong</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          The designs couldn&apos;t be loaded.
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          This is usually temporary. Please try again in a moment.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={ui.buttonPrimary}>
            Try again
          </button>
          <Link href="/" className={ui.buttonSecondary}>
            Go to the homepage
          </Link>
        </div>
      </main>
    </>
  );
}
