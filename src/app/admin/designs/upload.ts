import { MAX_IMAGE_LABEL } from "@/lib/designs/rules";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Opens the file in the browser to confirm it is a real image and read its size. */
export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () =>
      image.naturalWidth > 0
        ? resolve({ width: image.naturalWidth, height: image.naturalHeight })
        : reject(new Error("Image has no size"));
    image.onerror = () => reject(new Error("Image could not be decoded"));
    image.src = url;
  });
}

function describeUploadFailure(status: number, responseText: string): string {
  let message = "";
  try {
    const parsed = JSON.parse(responseText) as { message?: unknown; error?: unknown };
    message = String(parsed.message ?? parsed.error ?? "");
  } catch {
    // Not JSON; fall back to the status code.
  }

  if (status === 413 || /maximum allowed size|too large/i.test(message)) {
    return `This image is larger than the ${MAX_IMAGE_LABEL} limit.`;
  }
  if (status === 415 || /mime type/i.test(message)) {
    return "Only PNG, JPEG, and WebP images can be uploaded.";
  }
  if (/bucket not found/i.test(message)) {
    return "Image storage isn't set up yet. Run the SQL migration described in the README.";
  }
  if (status === 400 || status === 401 || status === 403 || /expired|signature|jwt/i.test(message)) {
    return "The upload link was rejected or has expired. Please choose the file again.";
  }
  return `The upload failed${message ? ` (${message})` : ""}. Please try again.`;
}

/**
 * Sends the file straight to Supabase Storage using the one-time link the
 * server created, reporting progress as it goes.
 */
export function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);

    const env = getSupabaseEnv();
    if (env) request.setRequestHeader("apikey", env.publishableKey);
    request.setRequestHeader("x-upsert", "false");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(describeUploadFailure(request.status, request.responseText)));
      }
    };
    request.onerror = () =>
      reject(
        new Error("The upload was interrupted. Check your internet connection and try again."),
      );

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    request.send(body);
  });
}
