"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import type { DesignRow } from "@/lib/designs/display";
import { DESIGN_COLUMNS } from "@/lib/designs/queries";
import {
  PRIVATE_BUCKET,
  buildImagePath,
  describeFileProblem,
  isImageContentType,
  isUuid,
  slugify,
  validateDesignInput,
  type DesignStatus,
  type FieldErrors,
} from "@/lib/designs/rules";
import {
  copyImagesToPublic,
  removePublicImages,
  removeUnusedUploads,
  removeUpload,
  verifyUploadedImage,
} from "@/lib/designs/storage";
import { createClient, type ServerClient } from "@/lib/supabase/server";

// Every action below is reachable by anyone who can send an HTTP request, so
// each one checks for an admin session first. The database rules check again.

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

type PostgrestLikeError = { code?: string; message: string };

async function requireAdminAction(): Promise<
  { supabase: ServerClient; error?: undefined } | { error: string }
> {
  const session = await getAdminSession();
  switch (session.status) {
    case "admin":
      return { supabase: session.supabase };
    case "signed-out":
      return {
        error:
          "Your login session has ended. Open /admin/login in a new tab, sign in, then try again here.",
      };
    case "not-admin":
      return { error: "This account doesn't have permission to manage designs." };
    default:
      return {
        error:
          "The site isn't fully set up yet. Follow the Supabase setup steps in the README.",
      };
  }
}

function describeDbError(error: PostgrestLikeError): string {
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST202"
  ) {
    return "The database isn't set up yet. Run the SQL migration described in the README.";
  }
  if (error.code === "42501") {
    return "This account doesn't have permission to do that.";
  }
  if (error.code === "23505") {
    return "Another design already uses this web address. Change the title slightly and try again.";
  }
  if (error.code === "23514") {
    return "Some details didn't pass the database checks. Review the fields and try again.";
  }
  return `Something went wrong while saving: ${error.message}`;
}

function describeStorageError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return "Image storage isn't set up yet. Run the SQL migration described in the README.";
  }
  if (/row-level security|unauthorized|not allowed/i.test(message)) {
    return "This account doesn't have permission to upload images.";
  }
  return `The image storage service returned an error: ${message}`;
}

function refreshSite() {
  revalidatePath("/", "layout");
}

/** Step 1 of an upload: the server approves it and returns a one-time upload link. */
export async function createImageUpload(input: {
  designId: string;
  kind: "design" | "mockup";
  contentType: string;
  size: number;
}): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  const auth = await requireAdminAction();
  if (auth.error !== undefined) return { ok: false, error: auth.error };

  const { designId, kind, contentType, size } = input ?? {};
  if (!isUuid(designId) || (kind !== "design" && kind !== "mockup")) {
    return {
      ok: false,
      error: "The upload couldn't be prepared. Reload the page and try again.",
    };
  }

  const problem = describeFileProblem({
    type: String(contentType),
    size: typeof size === "number" ? size : 0,
  });
  if (problem || !isImageContentType(contentType)) {
    return { ok: false, error: problem ?? "Unsupported image type." };
  }

  const path = buildImagePath(designId, kind, contentType, randomUUID());
  const { data, error } = await auth.supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return {
      ok: false,
      error: describeStorageError(error?.message ?? "No upload link returned."),
    };
  }
  return { ok: true, data: { path, signedUrl: data.signedUrl } };
}

async function uniqueSlug(
  supabase: ServerClient,
  title: string,
  designId: string,
): Promise<string> {
  const base = slugify(title);
  const { data } = await supabase
    .from("designs")
    .select("id, slug")
    .like("slug", `${base}%`);

  const taken = new Set(
    ((data ?? []) as { id: string; slug: string }[])
      .filter((row) => row.id !== designId)
      .map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

/** Reuses existing capitalization so "biology" and "Biology" share one filter. */
async function matchExistingSubject(
  supabase: ServerClient,
  subject: string,
): Promise<string> {
  const { data } = await supabase.from("designs").select("subject");
  const existing = ((data ?? []) as { subject: string }[]).find(
    (row) => row.subject.toLowerCase() === subject.toLowerCase(),
  );
  return existing?.subject ?? subject;
}

async function topSortOrder(supabase: ServerClient): Promise<number> {
  const { data } = await supabase
    .from("designs")
    .select("sort_order")
    .order("sort_order", { ascending: true })
    .limit(1);
  const lowest = (data as { sort_order: number }[] | null)?.[0]?.sort_order;
  return typeof lowest === "number" ? lowest - 1 : 0;
}

/** Creates or updates a design, then publishes or unpublishes its images to match. */
export async function saveDesign(
  raw: unknown,
): Promise<ActionResult<{ id: string; slug: string; status: DesignStatus }>> {
  const auth = await requireAdminAction();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const parsed = validateDesignInput(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.message, fieldErrors: parsed.errors };
  }
  const input = parsed.value;

  const { data: existingData, error: loadError } = await supabase
    .from("designs")
    .select(DESIGN_COLUMNS)
    .eq("id", input.id)
    .maybeSingle();
  if (loadError) return { ok: false, error: describeDbError(loadError) };
  const existing = existingData as DesignRow | null;

  // Check any newly uploaded files on the server before they are used.
  const newUploads: { field: "image" | "mockup"; path: string }[] = [];
  if (input.image.path !== existing?.image_path) {
    newUploads.push({ field: "image", path: input.image.path });
  }
  if (input.mockup && input.mockup.path !== existing?.mockup_path) {
    newUploads.push({ field: "mockup", path: input.mockup.path });
  }
  for (const upload of newUploads) {
    const check = await verifyUploadedImage(supabase, upload.path);
    if (!check.ok) {
      await removeUpload(supabase, upload.path);
      return {
        ok: false,
        error: check.message,
        fieldErrors: { [upload.field]: check.message },
      };
    }
  }

  const usedPaths = [input.image.path, input.mockup?.path].filter(
    (path): path is string => Boolean(path),
  );
  const publicPaths = input.status === "published" ? usedPaths : [];

  // Web addresses stay fixed once a design has been published, so shared links keep working.
  const slug = existing?.published_at
    ? existing.slug
    : await uniqueSlug(supabase, input.title, input.id);

  const record = {
    slug,
    title: input.title,
    subject: await matchExistingSubject(supabase, input.subject),
    description: input.description,
    alt_text: input.altText,
    product_type: input.productType,
    status: input.status,
    image_path: input.image.path,
    image_width: input.image.width,
    image_height: input.image.height,
    mockup_path: input.mockup?.path ?? null,
    mockup_alt_text: input.mockup ? input.mockupAltText || null : null,
    mockup_width: input.mockup?.width ?? null,
    mockup_height: input.mockup?.height ?? null,
  };

  // Publishing: copy images first, so the public page never points at a missing file.
  // Drafts: remove public copies first, so draft images are never left public.
  try {
    if (input.status === "published") {
      await copyImagesToPublic(supabase, input.id, publicPaths);
    } else {
      await removePublicImages(supabase, input.id);
    }
  } catch {
    return {
      ok: false,
      error:
        input.status === "published"
          ? "The images couldn't be prepared for publishing. Nothing was changed. Please try again."
          : "The public copies of the images couldn't be removed, so nothing was changed. Please try again.",
    };
  }

  const { error: writeError } = existing
    ? await supabase.from("designs").update(record).eq("id", input.id)
    : await supabase
        .from("designs")
        .insert({ id: input.id, ...record, sort_order: await topSortOrder(supabase) });

  if (writeError) {
    if (input.status === "published" && existing?.status !== "published") {
      await removePublicImages(supabase, input.id).catch(() => {});
    }
    return { ok: false, error: describeDbError(writeError) };
  }

  // Tidy up replaced images. Failures here don't affect what visitors see.
  await Promise.allSettled([
    removePublicImages(supabase, input.id, publicPaths),
    removeUnusedUploads(supabase, input.id, usedPaths),
  ]);

  refreshSite();
  if (!existing) {
    // New designs continue in the regular editor for that design.
    redirect(`/admin/designs/${input.id}?saved=${input.status}`);
  }
  return { ok: true, data: { id: input.id, slug, status: input.status } };
}

/** Quick publish or unpublish without opening the editor. */
export async function setDesignStatus(
  id: string,
  status: DesignStatus,
): Promise<ActionResult> {
  const auth = await requireAdminAction();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { supabase } = auth;

  if (!isUuid(id) || (status !== "draft" && status !== "published")) {
    return { ok: false, error: "Invalid request. Reload the page and try again." };
  }

  const { data, error } = await supabase
    .from("designs")
    .select(DESIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: describeDbError(error) };
  const row = data as DesignRow | null;
  if (!row) return { ok: false, error: "This design no longer exists." };

  const paths = [row.image_path, row.mockup_path].filter(
    (path): path is string => Boolean(path),
  );

  try {
    if (status === "published") await copyImagesToPublic(supabase, id, paths);
    else await removePublicImages(supabase, id);
  } catch {
    return {
      ok: false,
      error: "The images couldn't be updated, so nothing was changed. Please try again.",
    };
  }

  const { error: updateError } = await supabase
    .from("designs")
    .update({ status })
    .eq("id", id);
  if (updateError) {
    if (status === "published" && row.status !== "published") {
      await removePublicImages(supabase, id).catch(() => {});
    }
    return { ok: false, error: describeDbError(updateError) };
  }

  refreshSite();
  return { ok: true, data: null };
}

export async function deleteDesign(
  id: string,
  options: { returnToList?: boolean } = {},
): Promise<ActionResult> {
  const auth = await requireAdminAction();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { supabase } = auth;

  if (!isUuid(id)) {
    return { ok: false, error: "Invalid request. Reload the page and try again." };
  }

  try {
    await removePublicImages(supabase, id);
  } catch {
    return {
      ok: false,
      error: "The published images couldn't be removed, so nothing was deleted. Please try again.",
    };
  }

  const { error } = await supabase.from("designs").delete().eq("id", id);
  if (error) return { ok: false, error: describeDbError(error) };

  await removeUnusedUploads(supabase, id, []).catch(() => {});

  refreshSite();
  if (options.returnToList) redirect("/admin?deleted=1");
  return { ok: true, data: null };
}

/** Moves a design one place earlier or later in the display order. */
export async function moveDesign(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const auth = await requireAdminAction();
  if (auth.error !== undefined) return { ok: false, error: auth.error };
  const { supabase } = auth;

  if (!isUuid(id) || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Invalid request. Reload the page and try again." };
  }

  const { data, error } = await supabase
    .from("designs")
    .select("id")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: describeDbError(error) };

  const ids = (data as { id: string }[]).map((row) => row.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1) return { ok: false, error: "This design no longer exists." };
  if (to < 0 || to >= ids.length) return { ok: true, data: null };

  [ids[from], ids[to]] = [ids[to], ids[from]];

  const { error: reorderError } = await supabase.rpc("reorder_designs", {
    ordered_ids: ids,
  });
  if (reorderError) return { ok: false, error: describeDbError(reorderError) };

  refreshSite();
  return { ok: true, data: null };
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Not configured or already signed out: nothing to do.
  }
  redirect("/admin/login");
}
