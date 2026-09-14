import Link from "next/link";
import { siteConfig } from "@/config/site";

/** "Bidipta Roy | Educational Design" -> ["Bidipta Roy", "Educational Design"] */
export function splitSiteName(name: string): [string, string | null] {
  const [first, ...rest] = name.split("|").map((part) => part.trim());
  return [first, rest.length > 0 ? rest.join(" | ") : null];
}

export function SiteHeader() {
  const [primary, secondary] = splitSiteName(siteConfig.name);

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex flex-col leading-tight">
          <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            {primary}
          </span>
          {secondary && (
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft">
              {secondary}
            </span>
          )}
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm">
            <li>
              <Link
                href="/#designs"
                className="rounded-full px-3 py-2 transition hover:bg-paper-deep"
              >
                Designs
              </Link>
            </li>
            <li>
              <Link
                href="/#about"
                className="rounded-full px-3 py-2 transition hover:bg-paper-deep"
              >
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
