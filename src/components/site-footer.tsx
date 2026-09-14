import { siteConfig } from "@/config/site";
import { splitSiteName } from "./site-header";

export function SiteFooter() {
  const [, secondary] = splitSiteName(siteConfig.name);

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {new Date().getFullYear()} {siteConfig.owner}. Original artwork. Please
          don&apos;t reuse it without permission.
        </p>
        {secondary && (
          <p className="font-mono text-xs uppercase tracking-[0.16em]">{secondary}</p>
        )}
      </div>
    </footer>
  );
}
