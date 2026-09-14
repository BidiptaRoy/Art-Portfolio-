import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type { DisplayDesign } from "@/lib/designs/display";
import { ArtworkStage } from "./artwork-stage";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";

type Neighbor = { slug: string; title: string } | null;

type Props = {
  design: DisplayDesign;
  previous?: Neighbor;
  next?: Neighbor;
  /** h1 on the public page; h3 inside the admin preview. */
  headingLevel?: "h1" | "h3";
  /** False in the admin preview, where links should not navigate away. */
  interactive?: boolean;
  preloadImage?: boolean;
};

function Description({ text }: { text: string }) {
  return text.split(/\n{2,}/).map((paragraph, index) => (
    <p key={index}>
      {paragraph.split("\n").map((line, lineIndex, lines) => (
        <Fragment key={lineIndex}>
          {line}
          {lineIndex < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </p>
  ));
}

export function DesignDetail({
  design,
  previous = null,
  next = null,
  headingLevel = "h1",
  interactive = true,
  preloadImage = false,
}: Props) {
  const Heading = headingLevel;

  return (
    <article className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
      {interactive && (
        <Link
          href="/#designs"
          className="inline-flex items-center gap-2 rounded-full py-1 text-sm text-ink-soft transition hover:text-ink"
        >
          <ArrowLeftIcon /> All designs
        </Link>
      )}

      {/* Phones read top to bottom: artwork, text, mockup. Desktop puts the text in a sticky right column. */}
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-14">
        <div className="lg:col-start-1 lg:row-start-1">
          <ArtworkStage image={design.image} preload={preloadImage} />
        </div>

        <div
          className={`lg:sticky lg:top-10 lg:col-start-2 lg:row-start-1 lg:self-start ${
            design.mockup ? "lg:row-span-2" : ""
          }`}
        >
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            {design.subject}
          </p>
          <Heading className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
            {design.title}
          </Heading>

          {design.description && (
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft sm:text-lg">
              <Description text={design.description} />
            </div>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                Subject
              </dt>
              <dd className="mt-1">{design.subject}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
                Product
              </dt>
              <dd className="mt-1">{design.productType}</dd>
            </div>
          </dl>
        </div>

        {design.mockup && (
          <figure className="lg:col-start-1 lg:row-start-2">
            <div className="overflow-hidden rounded-3xl border border-line bg-card">
              <Image
                src={design.mockup.url}
                alt={design.mockup.alt}
                width={design.mockup.width}
                height={design.mockup.height}
                sizes="(min-width: 1024px) 620px, 100vw"
                quality={85}
                unoptimized={design.mockup.unoptimized}
                className="h-auto w-full"
              />
            </div>
            <figcaption className="mt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
              {design.productType} mockup
            </figcaption>
          </figure>
        )}
      </div>

      {interactive && (previous || next) && (
        <nav
          aria-label="More designs"
          className="mt-16 grid gap-4 border-t border-line pt-8 sm:grid-cols-2"
        >
          {previous ? (
            <Link
              href={`/designs/${previous.slug}`}
              className="group rounded-2xl border border-line bg-card p-5 transition hover:border-ink-faint"
            >
              <span className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
                <ArrowLeftIcon className="size-3.5" /> Previous
              </span>
              <span className="mt-2 block font-display text-xl">{previous.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={`/designs/${next.slug}`}
              className="group rounded-2xl border border-line bg-card p-5 transition hover:border-ink-faint sm:text-right"
            >
              <span className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft sm:justify-end">
                Next <ArrowRightIcon className="size-3.5" />
              </span>
              <span className="mt-2 block font-display text-xl">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
