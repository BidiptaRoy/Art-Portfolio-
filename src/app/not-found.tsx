import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ui } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className={`${ui.eyebrow} text-accent`}>Not found</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          This page isn&apos;t here.
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          The design may have been renamed or is no longer on display.
        </p>
        <Link href="/" className={`${ui.buttonPrimary} mt-8`}>
          See all designs
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
