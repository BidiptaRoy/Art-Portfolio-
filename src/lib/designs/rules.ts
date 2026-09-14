/**
 * Shared rules for designs and image uploads.
 *
 * Used by the browser (instant feedback) and by the server (the real check).
 * Keep this file free of imports so it can run anywhere, including tests.
 */

export const PRIVATE_BUCKET = "design-uploads";
export const PUBLIC_BUCKET = "published-designs";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_LABEL = "10 MB";

export const IMAGE_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type ImageContentType = keyof typeof IMAGE_EXTENSIONS;
export type ImageKind = "design" | "mockup";
export type DesignStatus = "draft" | "published";

export const ACCEPTED_IMAGE_TYPES = Object.keys(
  IMAGE_EXTENSIONS,
) as ImageContentType[];

export const LIMITS = {
  title: 120,
  subject: 60,
  description: 1000,
  altText: 300,
  productType: 40,
} as const;

export const DEFAULT_PRODUCT_TYPE = "T-shirt";

export const SUBJECT_SUGGESTIONS = [
  "Biology",
  "Immunology",
  "Anatomy",
  "Neuroscience",
  "Computer Science",
  "Chemistry",
  "Physics",
  "Mathematics",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isImageContentType(value: unknown): value is ImageContentType {
  return typeof value === "string" && value in IMAGE_EXTENSIONS;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a friendly problem description, or null when the file is acceptable. */
export function describeFileProblem(file: {
  name?: string;
  type: string;
  size: number;
}): string | null {
  const label = file.name ? `"${file.name}"` : "This file";
  if (!isImageContentType(file.type)) {
    return `${label} isn't a PNG, JPEG, or WebP image. Please choose one of those formats.`;
  }
  if (file.size <= 0) {
    return `${label} is empty. Please choose another file.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${label} is ${formatBytes(file.size)}. The limit is ${MAX_IMAGE_LABEL}. Try exporting a smaller web version (around 2000 to 3000 pixels tall is plenty).`;
  }
  return null;
}

/** Identifies PNG, JPEG, and WebP files from their first bytes (not their name). */
export function detectImageType(bytes: Uint8Array): ImageContentType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  // "RIFF" .... "WEBP"
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

export function buildImagePath(
  designId: string,
  kind: ImageKind,
  contentType: ImageContentType,
  fileId: string,
): string {
  return `${designId}/${kind}-${fileId}.${IMAGE_EXTENSIONS[contentType]}`;
}

/** Mirrors the path check in the database so bad paths fail early with a clear message. */
export function isValidImagePath(
  path: unknown,
  designId: string,
  kind: ImageKind,
): path is string {
  if (typeof path !== "string") return false;
  const match = /^([0-9a-f-]{36})\/(design|mockup)-([0-9a-f-]{36})\.(png|jpg|webp)$/.exec(
    path,
  );
  return (
    match !== null &&
    match[1] === designId &&
    match[2] === kind &&
    isUuid(match[1]) &&
    isUuid(match[3])
  );
}

export function contentTypeForPath(path: string): ImageContentType | null {
  const extension = path.split(".").pop();
  const entry = Object.entries(IMAGE_EXTENSIONS).find(
    ([, ext]) => ext === extension,
  );
  return entry ? (entry[0] as ImageContentType) : null;
}

// Invisible control characters can sneak in via copy and paste.
const CONTROL_CHARACTERS = /\p{Cc}/gu;
const CONTROL_CHARACTERS_EXCEPT_NEWLINE = /[^\P{Cc}\n]/gu;
const COMBINING_MARKS = /\p{M}/gu;

export function cleanSingleLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(CONTROL_CHARACTERS, "")
    .trim();
}

export function cleanMultiline(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROL_CHARACTERS_EXCEPT_NEWLINE, "")
    .split("\n")
    .map((line) => line.replace(/ +$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slugify(text: string): string {
  const base = text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) return "design";
  if (base.length <= 60) return base;
  const cut = base.slice(0, 60);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > 20 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "");
}

export type ImageRef = {
  path: string;
  width: number | null;
  height: number | null;
};

export type DesignInput = {
  id: string;
  title: string;
  subject: string;
  description: string;
  altText: string;
  productType: string;
  status: DesignStatus;
  image: ImageRef;
  mockup: ImageRef | null;
  mockupAltText: string;
};

export type DesignField =
  | "title"
  | "subject"
  | "description"
  | "altText"
  | "productType"
  | "status"
  | "image"
  | "mockup"
  | "mockupAltText";

export type FieldErrors = Partial<Record<DesignField, string>>;

function cleanDimension(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 30000
    ? value
    : null;
}

function readImageRef(
  value: unknown,
  designId: string,
  kind: ImageKind,
): ImageRef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isValidImagePath(record.path, designId, kind)) return null;
  return {
    path: record.path,
    width: cleanDimension(record.width),
    height: cleanDimension(record.height),
  };
}

export function validateDesignInput(
  raw: unknown,
):
  | { ok: true; value: DesignInput }
  | { ok: false; errors: FieldErrors; message: string } {
  const errors: FieldErrors = {};
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  if (!isUuid(record.id)) {
    return {
      ok: false,
      errors,
      message: "This design is missing its ID. Reload the page and try again.",
    };
  }
  const id = record.id;

  const title = cleanSingleLine(record.title);
  if (!title) errors.title = "Add a title.";
  else if (title.length > LIMITS.title)
    errors.title = `Keep the title under ${LIMITS.title} characters.`;

  const subject = cleanSingleLine(record.subject);
  if (!subject) errors.subject = "Add a subject, such as Biology.";
  else if (subject.length > LIMITS.subject)
    errors.subject = `Keep the subject under ${LIMITS.subject} characters.`;

  const description = cleanMultiline(record.description);
  if (description.length > LIMITS.description)
    errors.description = `Keep the description under ${LIMITS.description} characters (currently ${description.length}).`;

  const altText = cleanSingleLine(record.altText);
  if (!altText)
    errors.altText =
      "Describe the artwork in a sentence for people who can't see the image.";
  else if (altText.length > LIMITS.altText)
    errors.altText = `Keep the image description under ${LIMITS.altText} characters.`;

  const productType =
    cleanSingleLine(record.productType) || DEFAULT_PRODUCT_TYPE;
  if (productType.length > LIMITS.productType)
    errors.productType = `Keep the product type under ${LIMITS.productType} characters.`;

  const status = record.status;
  if (status !== "draft" && status !== "published")
    errors.status = "Choose whether to save as a draft or publish.";

  const image = readImageRef(record.image, id, "design");
  if (!image) errors.image = "Upload the main design image.";

  let mockup: ImageRef | null = null;
  if (record.mockup != null) {
    mockup = readImageRef(record.mockup, id, "mockup");
    if (!mockup)
      errors.mockup = "The mockup upload didn't finish. Remove it or upload it again.";
  }

  const mockupAltText = mockup ? cleanSingleLine(record.mockupAltText) : "";
  if (mockupAltText.length > LIMITS.altText)
    errors.mockupAltText = `Keep the mockup description under ${LIMITS.altText} characters.`;

  if (Object.keys(errors).length > 0 || !image) {
    return {
      ok: false,
      errors,
      message: "Some details need attention before this can be saved.",
    };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      subject,
      description,
      altText,
      productType,
      status: status as DesignStatus,
      image,
      mockup,
      mockupAltText,
    },
  };
}
