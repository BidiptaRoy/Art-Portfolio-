import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { ui } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";
import { createSignedImageUrls, listAllDesigns } from "@/lib/designs/queries";
import { AdminHeader } from "./admin-header";
import { DesignList, type DesignListItem } from "./design-list";

export const metadata: Metadata = { title: "Designs" };

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  const session = await requireAdminPage();
  const [rows, params] = await Promise.all([
    listAllDesigns(session.supabase),
    searchParams,
  ]);
  const thumbnails = await createSignedImageUrls(
    session.supabase,
    rows.map((row) => row.image_path),
  );

  const items: DesignListItem[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    subject: row.subject,
    productType: row.product_type,
    status: row.status,
    thumbnailUrl: thumbnails[row.image_path] ?? null,
  }));
  const publishedCount = rows.filter((row) => row.status === "published").length;
  const draftCount = rows.length - publishedCount;

  return (
    <>
      <AdminHeader email={session.email} />
      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Your designs</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {rows.length === 0
                ? "Nothing uploaded yet."
                : `${publishedCount} published · ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}. Drafts are only visible to you.`}
            </p>
          </div>
          <Link href="/admin/designs/new" className={ui.buttonPrimary}>
            <PlusIcon /> Upload a design
          </Link>
        </div>

        {params.deleted === "1" && (
          <p role="status" className="mt-6 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
            The design was deleted.
          </p>
        )}

        <div className="mt-8">
          {rows.length === 0 ? <FirstDesignGuide /> : <DesignList items={items} />}
        </div>
      </main>
    </>
  );
}

function FirstDesignGuide() {
  const steps = [
    {
      title: "Upload the artwork",
      body: "A PNG with a transparent background works best. JPEG and WebP are fine too (up to 10 MB). A T-shirt mockup is optional.",
    },
    {
      title: "Describe it",
      body: "Add a title, a subject such as Biology, a short description of what it teaches, and one sentence describing the image for screen readers.",
    },
    {
      title: "Preview, then publish",
      body: "Check how it will look. Publish when you're happy, and it appears on the portfolio straight away. You can also save it as a private draft.",
    },
  ];

  return (
    <div className="rounded-3xl border border-line bg-card p-6 sm:p-10">
      <h2 className="font-display text-2xl tracking-tight">Add your first design</h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="font-mono text-xs text-accent">0{index + 1}</span>
            <h3 className="mt-1 font-medium">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
      <Link href="/admin/designs/new" className={`${ui.buttonAccent} mt-8`}>
        <PlusIcon /> Upload your first design
      </Link>
    </div>
  );
}
