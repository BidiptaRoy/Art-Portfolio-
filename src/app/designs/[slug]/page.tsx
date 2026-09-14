import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignDetail } from "@/components/design-detail";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedDesigns } from "@/lib/designs/queries";

async function findDesign(slug: string) {
  const { designs } = await getPublishedDesigns();
  const index = designs.findIndex((design) => design.slug === slug);
  if (index === -1) return null;
  return {
    design: designs[index],
    previous: designs[index - 1] ?? null,
    next: designs[index + 1] ?? null,
  };
}

function summarize(text: string, maxLength = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= maxLength ? flat : `${flat.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: PageProps<"/designs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = await findDesign(slug);
  if (!found) return { title: "Design not found" };

  const { design } = found;
  const description = design.description
    ? summarize(design.description)
    : `${design.title}: an educational ${design.productType.toLowerCase()} design about ${design.subject}.`;

  return {
    title: design.title,
    description,
    alternates: { canonical: `/designs/${design.slug}` },
    openGraph: {
      type: "article",
      title: design.title,
      description,
      images: [
        {
          url: design.image.url,
          width: design.image.width,
          height: design.image.height,
          alt: design.image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: design.title,
      description,
      images: [design.image.url],
    },
  };
}

export default async function DesignPage({ params }: PageProps<"/designs/[slug]">) {
  const { slug } = await params;
  const found = await findDesign(slug);
  if (!found) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <DesignDetail
          design={found.design}
          previous={found.previous}
          next={found.next}
          preloadImage
        />
      </main>
      <SiteFooter />
    </>
  );
}
