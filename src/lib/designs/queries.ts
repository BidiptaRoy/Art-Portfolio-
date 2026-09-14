import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { ServerClient } from "@/lib/supabase/server";
import { toDisplayDesign, type DesignRow, type DisplayDesign } from "./display";
import { PRIVATE_BUCKET, PUBLIC_BUCKET } from "./rules";

export const DESIGN_COLUMNS =
  "id, slug, title, subject, description, alt_text, product_type, status, sort_order, image_path, image_width, image_height, mockup_path, mockup_alt_text, mockup_width, mockup_height, published_at, created_at, updated_at";

/**
 * Published designs in gallery order, read as an anonymous visitor.
 * Runs on every request so new uploads appear without a redeploy.
 */
export const getPublishedDesigns = cache(
  async (): Promise<{ configured: boolean; designs: DisplayDesign[] }> => {
    await connection();

    const supabase = createPublicClient();
    if (!supabase) return { configured: false, designs: [] };

    const { data, error } = await supabase
      .from("designs")
      .select(DESIGN_COLUMNS)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Could not load designs: ${error.message}`);

    const bucket = supabase.storage.from(PUBLIC_BUCKET);
    const designs = (data as DesignRow[]).map((row) =>
      toDisplayDesign(row, (path) => bucket.getPublicUrl(path).data.publicUrl),
    );
    return { configured: true, designs };
  },
);

/** Every design, drafts included. Requires an admin client. */
export async function listAllDesigns(supabase: ServerClient): Promise<DesignRow[]> {
  const { data, error } = await supabase
    .from("designs")
    .select(DESIGN_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load designs: ${error.message}`);
  return data as DesignRow[];
}

export async function getDesignRow(
  supabase: ServerClient,
  id: string,
): Promise<DesignRow | null> {
  const { data, error } = await supabase
    .from("designs")
    .select(DESIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load the design: ${error.message}`);
  return data as DesignRow | null;
}

/** Subjects already in use, so the form can suggest consistent spelling. */
export async function listSubjects(supabase: ServerClient): Promise<string[]> {
  const { data, error } = await supabase.from("designs").select("subject");
  if (error) return [];

  const bySpelling = new Map<string, string>();
  for (const { subject } of data as { subject: string }[]) {
    const key = subject.toLowerCase();
    if (!bySpelling.has(key)) bySpelling.set(key, subject);
  }
  return [...bySpelling.values()].sort((a, b) => a.localeCompare(b));
}

/** Temporary links for private (possibly draft) images, for the owner's eyes only. */
export async function createSignedImageUrls(
  supabase: ServerClient,
  paths: string[],
  expiresInSeconds = 6 * 60 * 60,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}
