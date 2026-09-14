import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { createSignedImageUrls, getDesignRow, listSubjects } from "@/lib/designs/queries";
import { isUuid } from "@/lib/designs/rules";
import { AdminHeader } from "../../admin-header";
import { DesignEditor, type EditorDesign } from "../design-editor";

export const metadata: Metadata = { title: "Edit design" };

export default async function EditDesignPage({
  params,
  searchParams,
}: PageProps<"/admin/designs/[id]">) {
  const session = await requireAdminPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();

  const [row, subjects] = await Promise.all([
    getDesignRow(session.supabase, id),
    listSubjects(session.supabase),
  ]);
  if (!row) notFound();

  const urls = await createSignedImageUrls(
    session.supabase,
    row.mockup_path ? [row.image_path, row.mockup_path] : [row.image_path],
  );

  const design: EditorDesign = {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    subject: row.subject,
    description: row.description,
    altText: row.alt_text,
    productType: row.product_type,
    mockupAltText: row.mockup_alt_text ?? "",
    image: {
      path: row.image_path,
      width: row.image_width,
      height: row.image_height,
      url: urls[row.image_path] ?? null,
    },
    mockup: row.mockup_path
      ? {
          path: row.mockup_path,
          width: row.mockup_width,
          height: row.mockup_height,
          url: urls[row.mockup_path] ?? null,
        }
      : null,
  };

  const notice = query.saved === "published" || query.saved === "draft" ? query.saved : null;

  return (
    <>
      <AdminHeader email={session.email} />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <DesignEditor
          key={row.id}
          design={design}
          isNew={false}
          subjects={subjects}
          initialView={query.view === "preview" ? "preview" : "edit"}
          initialNotice={notice}
        />
      </main>
    </>
  );
}
