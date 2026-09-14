import Image from "next/image";
import Link from "next/link";
import type { DisplayDesign } from "@/lib/designs/display";

type Props = {
  design: DisplayDesign;
  index: number;
  /** False in the admin preview, where the card should not navigate. */
  interactive?: boolean;
};

export function DesignCard({ design, index, interactive = true }: Props) {
  const content = (
    <>
      <div className="relative aspect-[5/6] overflow-hidden rounded-2xl border border-line bg-tile transition duration-300 group-hover:border-ink-faint">
        <Image
          src={design.image.url}
          alt={design.image.alt}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 768px) 30vw, 50vw"
          quality={85}
          unoptimized={design.image.unoptimized}
          className="object-contain p-[8%] transition duration-500 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base leading-snug text-balance sm:text-lg">
          {design.title}
        </h3>
        <span aria-hidden="true" className="font-mono text-xs text-ink-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent">
        {design.subject}
      </p>
    </>
  );

  if (!interactive) return <div className="group">{content}</div>;

  return (
    <Link href={`/designs/${design.slug}`} className="group block rounded-2xl">
      {content}
    </Link>
  );
}
