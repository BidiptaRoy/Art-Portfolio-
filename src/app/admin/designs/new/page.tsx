import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { listSubjects } from "@/lib/designs/queries";
import { DEFAULT_PRODUCT_TYPE } from "@/lib/designs/rules";
import { AdminHeader } from "../../admin-header";
import { DesignEditor } from "../design-editor";

export const metadata: Metadata = { title: "Upload a design" };

export default async function NewDesignPage() {
  const session = await requireAdminPage();
  const subjects = await listSubjects(session.supabase);

  return (
    <>
      <AdminHeader email={session.email} />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <DesignEditor
          isNew
          subjects={subjects}
          initialView="edit"
          initialNotice={null}
          design={{
            id: randomUUID(),
            slug: null,
            status: "draft",
            title: "",
            subject: "",
            description: "",
            altText: "",
            productType: DEFAULT_PRODUCT_TYPE,
            mockupAltText: "",
            image: null,
            mockup: null,
          }}
        />
      </main>
    </>
  );
}
