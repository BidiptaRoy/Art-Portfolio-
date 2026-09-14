import { Gallery } from "@/components/gallery";
import { ShirtIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ui } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getPublishedDesigns } from "@/lib/designs/queries";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const [{ configured, designs }, params] = await Promise.all([
    getPublishedDesigns(),
    searchParams,
  ]);
  const subject = typeof params.subject === "string" ? params.subject : null;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-20">
          <p className={`${ui.eyebrow} text-accent`}>{siteConfig.intro.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.6rem] leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {siteConfig.intro.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            {siteConfig.intro.lede}
          </p>
        </section>

        <section
          id="designs"
          aria-labelledby="designs-heading"
          className="scroll-mt-4 border-t border-line"
        >
          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
            <div className="mb-8 flex items-baseline justify-between gap-4">
              <h2
                id="designs-heading"
                className="font-display text-3xl tracking-tight sm:text-4xl"
              >
                Designs
              </h2>
              {designs.length > 0 && (
                <p className={`${ui.eyebrow} text-ink-soft`}>
                  {designs.length} {designs.length === 1 ? "design" : "designs"}
                </p>
              )}
            </div>
            {designs.length > 0 ? (
              <Gallery designs={designs} initialSubject={subject} />
            ) : (
              <EmptyGallery configured={configured} />
            )}
          </div>
        </section>

        <section
          id="about"
          aria-labelledby="about-heading"
          className="scroll-mt-4 border-t border-line bg-paper-deep/60"
        >
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1fr_1.4fr] md:gap-16">
            <div>
              <p className={`${ui.eyebrow} text-accent`}>About</p>
              <h2
                id="about-heading"
                className="mt-3 font-display text-3xl tracking-tight text-balance sm:text-4xl"
              >
                {siteConfig.about.heading}
              </h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-ink-soft">
              {siteConfig.about.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyGallery({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-card/60 px-6 py-16 text-center">
      <ShirtIcon className="mx-auto size-12 text-ink-faint" />
      <p className="mt-4 font-display text-2xl">The first designs are on their way.</p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        New artwork will appear here as soon as it&apos;s published. Please check back soon.
      </p>
      {!configured && process.env.NODE_ENV === "development" && (
        <p className="mx-auto mt-6 max-w-md rounded-xl bg-warning-soft px-4 py-3 text-left text-sm text-ink">
          <strong>Developer note (only shown locally):</strong> Supabase isn&apos;t
          connected yet. Copy <code>.env.example</code> to <code>.env.local</code>, add
          your project values, and restart <code>npm run dev</code>. See the README.
        </p>
      )}
    </div>
  );
}
