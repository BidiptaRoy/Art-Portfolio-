import type { DesignStatus } from "./rules";

/** A row of the public.designs table. */
export type DesignRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  description: string;
  alt_text: string;
  product_type: string;
  status: DesignStatus;
  sort_order: number;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  mockup_path: string | null;
  mockup_alt_text: string | null;
  mockup_width: number | null;
  mockup_height: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisplayImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** True for temporary links (drafts, local previews) that should not be resized by Next.js. */
  unoptimized?: boolean;
};

export type DisplayDesign = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  description: string;
  productType: string;
  image: DisplayImage;
  mockup: DisplayImage | null;
};

// Used when an image's size is unknown. Matches a typical T-shirt print area.
export const FALLBACK_IMAGE_SIZE = { width: 1500, height: 1800 };

export function defaultMockupAlt(title: string, productType: string): string {
  return `Mockup of the "${title}" design on a ${productType.toLowerCase()}`;
}

export function toDisplayDesign(
  row: DesignRow,
  resolveUrl: (path: string) => string,
  options: { unoptimized?: boolean } = {},
): DisplayDesign {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: row.subject,
    description: row.description,
    productType: row.product_type,
    image: {
      url: resolveUrl(row.image_path),
      alt: row.alt_text,
      width: row.image_width ?? FALLBACK_IMAGE_SIZE.width,
      height: row.image_height ?? FALLBACK_IMAGE_SIZE.height,
      unoptimized: options.unoptimized,
    },
    mockup: row.mockup_path
      ? {
          url: resolveUrl(row.mockup_path),
          alt: row.mockup_alt_text || defaultMockupAlt(row.title, row.product_type),
          width: row.mockup_width ?? FALLBACK_IMAGE_SIZE.width,
          height: row.mockup_height ?? FALLBACK_IMAGE_SIZE.height,
          unoptimized: options.unoptimized,
        }
      : null,
  };
}
