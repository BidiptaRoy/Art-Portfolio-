"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { DisplayImage } from "@/lib/designs/display";

// Lets visitors see transparent artwork the way it would look on different shirt colors.
const BACKDROPS = [
  { id: "light", label: "Light", color: "#f3f1ec" },
  { id: "heather", label: "Heather", color: "#a8a6a0" },
  { id: "dark", label: "Dark", color: "#1f1f22" },
] as const;

type BackdropId = (typeof BACKDROPS)[number]["id"];

export function ArtworkStage({
  image,
  preload = false,
}: {
  image: DisplayImage;
  preload?: boolean;
}) {
  const name = useId();
  const [backdrop, setBackdrop] = useState<BackdropId>("light");
  const color = BACKDROPS.find((option) => option.id === backdrop)?.color;

  return (
    <figure>
      <div
        className="flex items-center justify-center overflow-hidden rounded-3xl border border-line p-6 transition-colors duration-300 sm:p-10"
        style={{ backgroundColor: color }}
      >
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(min-width: 1024px) 620px, 100vw"
          quality={85}
          preload={preload}
          unoptimized={image.unoptimized}
          className="h-auto max-h-[72vh] w-auto max-w-full object-contain"
        />
      </div>
      <fieldset className="mt-3">
        <legend className="sr-only">Background color behind the artwork</legend>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="mr-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-soft">
            Shirt color
          </span>
          {BACKDROPS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-2.5 py-1 text-xs transition hover:border-ink-faint has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={backdrop === option.id}
                onChange={() => setBackdrop(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="size-3.5 rounded-full border border-black/15"
                style={{ backgroundColor: option.color }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </figure>
  );
}
