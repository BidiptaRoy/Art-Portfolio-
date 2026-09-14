import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  contentTypeForPath,
  detectImageType,
  formatBytes,
} from "./rules";

export class StorageStepError extends Error {}

async function readFirstBytes(
  body: ReadableStream<Uint8Array>,
  count: number,
): Promise<Uint8Array> {
  const reader = body.getReader();
  const bytes = new Uint8Array(count);
  let filled = 0;
  try {
    while (filled < count) {
      const { done, value } = await reader.read();
      if (done) break;
      const piece = value.subarray(0, count - filled);
      bytes.set(piece, filled);
      filled += piece.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return bytes.subarray(0, filled);
}

/**
 * Checks an uploaded file on the server: it must exist, respect the size
 * limit, and really be a PNG, JPEG, or WebP image (judged by its contents,
 * not its name).
 */
export async function verifyUploadedImage(
  supabase: ServerClient,
  path: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const missing = {
    ok: false as const,
    message: "The uploaded image couldn't be found. Please upload it again.",
  };

  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return missing;

  let response: Response;
  try {
    response = await fetch(data.signedUrl, { cache: "no-store" });
  } catch {
    return {
      ok: false,
      message: "The image storage service couldn't be reached. Please try again.",
    };
  }
  if (!response.ok || !response.body) return missing;

  const length = Number(response.headers.get("content-length"));
  if (length > MAX_IMAGE_BYTES) {
    await response.body.cancel().catch(() => {});
    return {
      ok: false,
      message: `This image is ${formatBytes(length)}. The limit is ${MAX_IMAGE_LABEL}.`,
    };
  }

  const detected = detectImageType(await readFirstBytes(response.body, 16));
  if (!detected) {
    return {
      ok: false,
      message:
        "This file isn't a valid PNG, JPEG, or WebP image. Please export it again and upload the new file.",
    };
  }
  if (detected !== contentTypeForPath(path)) {
    return {
      ok: false,
      message:
        "This file's contents don't match its file type (for example, a WebP image renamed to .png). Please export it again as PNG, JPEG, or WebP.",
    };
  }
  return { ok: true };
}

async function listFolder(
  supabase: ServerClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000 });
  if (error) throw new StorageStepError(error.message);
  return (data ?? [])
    .filter((item) => item.id !== null)
    .map((item) => `${folder}/${item.name}`);
}

/** Copies a design's images into the public bucket (skipping ones already there). */
export async function copyImagesToPublic(
  supabase: ServerClient,
  designId: string,
  paths: string[],
): Promise<void> {
  const existing = new Set(await listFolder(supabase, PUBLIC_BUCKET, designId));
  for (const path of paths) {
    if (existing.has(path)) continue;
    const { error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .copy(path, path, { destinationBucket: PUBLIC_BUCKET });
    if (error) throw new StorageStepError(error.message);
  }
}

/** Removes a design's public image copies, except the paths listed in `keep`. */
export async function removePublicImages(
  supabase: ServerClient,
  designId: string,
  keep: string[] = [],
): Promise<void> {
  const stale = (await listFolder(supabase, PUBLIC_BUCKET, designId)).filter(
    (path) => !keep.includes(path),
  );
  if (stale.length === 0) return;
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove(stale);
  if (error) throw new StorageStepError(error.message);
}

/** Deletes uploads in a design's private folder that the design no longer uses. */
export async function removeUnusedUploads(
  supabase: ServerClient,
  designId: string,
  keep: string[],
): Promise<void> {
  const unused = (await listFolder(supabase, PRIVATE_BUCKET, designId)).filter(
    (path) => !keep.includes(path),
  );
  if (unused.length === 0) return;
  const { error } = await supabase.storage.from(PRIVATE_BUCKET).remove(unused);
  if (error) throw new StorageStepError(error.message);
}

export async function removeUpload(supabase: ServerClient, path: string): Promise<void> {
  await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
}
