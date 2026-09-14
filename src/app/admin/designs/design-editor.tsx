"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DesignCard } from "@/components/design-card";
import { DesignDetail } from "@/components/design-detail";
import { ArrowLeftIcon, CheckIcon, UploadIcon, XIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { ui } from "@/components/ui";
import {
  FALLBACK_IMAGE_SIZE,
  defaultMockupAlt,
  type DisplayDesign,
} from "@/lib/designs/display";
import {
  ACCEPTED_IMAGE_TYPES,
  DEFAULT_PRODUCT_TYPE,
  LIMITS,
  MAX_IMAGE_LABEL,
  SUBJECT_SUGGESTIONS,
  describeFileProblem,
  validateDesignInput,
  type DesignField,
  type DesignStatus,
  type FieldErrors,
  type ImageKind,
} from "@/lib/designs/rules";
import { createImageUpload, deleteDesign, saveDesign } from "../actions";
import { readImageSize, uploadWithProgress } from "./upload";

export type EditorImage = {
  path: string;
  width: number | null;
  height: number | null;
  /** A temporary private link (saved images) or a local preview (new uploads). */
  url: string | null;
};

export type EditorDesign = {
  id: string;
  slug: string | null;
  status: DesignStatus;
  title: string;
  subject: string;
  description: string;
  altText: string;
  productType: string;
  mockupAltText: string;
  image: EditorImage | null;
  mockup: EditorImage | null;
};

type ReadyImage = EditorImage & { uploadedName: string | null };

type Slot =
  | { state: "empty"; error?: string }
  | {
      state: "uploading";
      progress: number;
      previewUrl: string;
      fileName: string;
      previous: ReadyImage | null;
    }
  | { state: "ready"; image: ReadyImage; error?: string };

type TextFields = Pick<
  EditorDesign,
  "title" | "subject" | "description" | "altText" | "productType" | "mockupAltText"
>;

const FIELD_IDS: Record<DesignField, string> = {
  image: "design-image",
  mockup: "mockup-image",
  title: "design-title",
  subject: "design-subject",
  description: "design-description",
  altText: "design-alt-text",
  mockupAltText: "design-mockup-alt-text",
  productType: "design-product-type",
  status: "design-actions",
};

function slotFor(image: EditorImage | null): Slot {
  return image ? { state: "ready", image: { ...image, uploadedName: null } } : { state: "empty" };
}

function readyImage(slot: Slot): ReadyImage | null {
  return slot.state === "ready" ? slot.image : null;
}

type Props = {
  design: EditorDesign;
  isNew: boolean;
  subjects: string[];
  initialView: "edit" | "preview";
  initialNotice: DesignStatus | null;
};

export function DesignEditor({ design, isNew, subjects, initialView, initialNotice }: Props) {
  // Captured once so the upload folder can never change while editing.
  const [designId] = useState(design.id);
  const [fields, setFields] = useState<TextFields>({
    title: design.title,
    subject: design.subject,
    description: design.description,
    altText: design.altText,
    productType: design.productType,
    mockupAltText: design.mockupAltText,
  });
  const [imageSlot, setImageSlot] = useState<Slot>(() => slotFor(design.image));
  const [mockupSlot, setMockupSlot] = useState<Slot>(() => slotFor(design.mockup));
  const [savedStatus, setSavedStatus] = useState<DesignStatus>(design.status);
  const [slug, setSlug] = useState(design.slug);
  const [view, setView] = useState(initialView);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ text: string; key: number } | null>(null);
  const [notice, setNotice] = useState<DesignStatus | null>(initialNotice);
  const [dirty, setDirty] = useState(false);
  const [savingAs, setSavingAs] = useState<DesignStatus | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);

  const uploading = imageSlot.state === "uploading" || mockupSlot.state === "uploading";
  const busy = isSaving || isDeleting;
  const isPublished = !isNew && savedStatus === "published";

  const subjectOptions = useMemo(() => {
    const bySpelling = new Map<string, string>();
    for (const subject of [...subjects, ...SUBJECT_SUGGESTIONS]) {
      if (!bySpelling.has(subject.toLowerCase())) bySpelling.set(subject.toLowerCase(), subject);
    }
    return [...bySpelling.values()];
  }, [subjects]);

  // Drop one-time flags (?saved=, ?view=) so reloading doesn't repeat them.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("saved") || url.searchParams.has("view")) {
      url.searchParams.delete("saved");
      url.searchParams.delete("view");
      window.history.replaceState(null, "", url);
    }
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (view === "preview") {
      window.scrollTo({ top: 0 });
      previewHeadingRef.current?.focus();
    }
  }, [view]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  function updateField(name: keyof TextFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setFieldErrors((errors) => (errors[name] ? { ...errors, [name]: undefined } : errors));
  }

  function showError(text: string, errors: FieldErrors = {}) {
    setFieldErrors(errors);
    setFormError({ text, key: Date.now() });
  }

  async function handleFile(kind: ImageKind, file: File) {
    const setSlot = kind === "design" ? setImageSlot : setMockupSlot;
    const current = kind === "design" ? imageSlot : mockupSlot;
    if (current.state === "uploading") return;

    const previous = readyImage(current);
    const fail = (message: string) =>
      setSlot(
        previous
          ? { state: "ready", image: previous, error: message }
          : { state: "empty", error: message },
      );

    setNotice(null);
    const problem = describeFileProblem(file);
    if (problem) {
      fail(problem);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    let size: { width: number; height: number };
    try {
      size = await readImageSize(previewUrl);
    } catch {
      URL.revokeObjectURL(previewUrl);
      fail(`"${file.name}" couldn't be opened as an image. The file may be damaged.`);
      return;
    }

    setSlot({ state: "uploading", progress: 0, previewUrl, fileName: file.name, previous });
    setFieldErrors((errors) => ({ ...errors, [kind === "design" ? "image" : "mockup"]: undefined }));

    try {
      const prepared = await createImageUpload({
        designId,
        kind,
        contentType: file.type,
        size: file.size,
      });
      if (!prepared.ok) throw new Error(prepared.error);

      await uploadWithProgress(prepared.data.signedUrl, file, (fraction) =>
        setSlot((slot) =>
          slot.state === "uploading" && slot.previewUrl === previewUrl
            ? { ...slot, progress: fraction }
            : slot,
        ),
      );

      setSlot({
        state: "ready",
        image: {
          path: prepared.data.path,
          width: size.width,
          height: size.height,
          url: previewUrl,
          uploadedName: file.name,
        },
      });
      setDirty(true);
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      fail(error instanceof Error ? error.message : "The upload failed. Please try again.");
    }
  }

  function removeMockup() {
    setMockupSlot({ state: "empty" });
    setDirty(true);
    setFieldErrors((errors) => ({ ...errors, mockup: undefined, mockupAltText: undefined }));
  }

  function buildPayload(status: DesignStatus) {
    const image = readyImage(imageSlot);
    const mockup = readyImage(mockupSlot);
    return {
      id: designId,
      ...fields,
      status,
      image: image && { path: image.path, width: image.width, height: image.height },
      mockup: mockup && { path: mockup.path, width: mockup.width, height: mockup.height },
    };
  }

  /** Same checks the server runs, for instant feedback. */
  function checkLocally(status: DesignStatus) {
    if (uploading) {
      showError("Please wait for the upload to finish.");
      return null;
    }
    const payload = buildPayload(status);
    const result = validateDesignInput(payload);
    if (!result.ok) {
      setView("edit");
      showError(result.message, result.errors);
      return null;
    }
    return payload;
  }

  function openPreview() {
    if (!checkLocally(savedStatus)) return;
    if (!readyImage(imageSlot)?.url) {
      showError("The saved image couldn't be loaded for the preview. Reload the page and try again.");
      return;
    }
    setFormError(null);
    setFieldErrors({});
    setView("preview");
  }

  function save(status: DesignStatus) {
    const payload = checkLocally(status);
    if (!payload) return;

    setFormError(null);
    setFieldErrors({});
    setNotice(null);
    setSavingAs(status);
    startSaving(async () => {
      const result = await saveDesign(payload);
      setSavingAs(null);
      // New designs are redirected to their own edit page by the server.
      if (!result) return;

      if (!result.ok) {
        const errors = result.fieldErrors ?? {};
        if (errors.image) setImageSlot({ state: "empty", error: errors.image });
        if (errors.mockup) setMockupSlot({ state: "empty", error: errors.mockup });
        if (Object.keys(errors).length > 0) setView("edit");
        showError(result.error, errors);
        return;
      }

      setDirty(false);
      setSavedStatus(result.data.status);
      setSlug(result.data.slug);
      setView("edit");
      setNotice(result.data.status);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function confirmDelete() {
    setDeleteError(null);
    startDeleting(async () => {
      const result = await deleteDesign(designId, { returnToList: true });
      if (result && !result.ok) setDeleteError(result.error);
    });
  }

  const image = readyImage(imageSlot);
  const mockup = readyImage(mockupSlot);
  const productType = fields.productType.trim() || DEFAULT_PRODUCT_TYPE;
  const previewTitle = fields.title.trim() || "Untitled design";
  const mockupAltFallback = defaultMockupAlt(previewTitle, productType);

  const previewDesign: DisplayDesign | null = image?.url
    ? {
        id: designId,
        slug: slug ?? "preview",
        title: previewTitle,
        subject: fields.subject.trim(),
        description: fields.description.trim(),
        productType,
        image: {
          url: image.url,
          alt: fields.altText.trim(),
          width: image.width ?? FALLBACK_IMAGE_SIZE.width,
          height: image.height ?? FALLBACK_IMAGE_SIZE.height,
          unoptimized: true,
        },
        mockup: mockup?.url
          ? {
              url: mockup.url,
              alt: fields.mockupAltText.trim() || mockupAltFallback,
              width: mockup.width ?? FALLBACK_IMAGE_SIZE.width,
              height: mockup.height ?? FALLBACK_IMAGE_SIZE.height,
              unoptimized: true,
            }
          : null,
      }
    : null;

  const errorEntries = Object.entries(fieldErrors).filter(
    (entry): entry is [DesignField, string] => Boolean(entry[1]),
  );

  const actionsDisabled = busy || uploading;

  return (
    <div>
      <Link
        href="/admin"
        onClick={(event) => {
          if ((dirty || uploading) && !window.confirm("Leave without saving? Your changes will be lost.")) {
            event.preventDefault();
          }
        }}
        className="inline-flex items-center gap-2 text-sm text-ink-soft transition hover:text-ink"
      >
        <ArrowLeftIcon /> All designs
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {isNew ? "Upload a design" : "Edit design"}
        </h1>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <StatusBadge status={isNew ? "new" : savedStatus} />
          {isNew
            ? "Stays private until you publish"
            : isPublished
              ? "Visible on your portfolio"
              : "Only you can see this draft"}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft px-4 py-3 text-sm text-success"
          >
            <CheckIcon className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {notice === "published"
                  ? "Published. It's live on your portfolio now."
                  : "Saved as a draft. Only you can see it."}
              </p>
              {notice === "published" && slug && (
                <Link
                  href={`/designs/${slug}`}
                  target="_blank"
                  className="mt-1 inline-block underline underline-offset-2"
                >
                  View it on the portfolio<span className="sr-only"> (opens in a new tab)</span>
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-full p-1 transition hover:bg-success/10"
            >
              <XIcon />
              <span className="sr-only">Dismiss message</span>
            </button>
          </div>
        )}

        {formError && (
          <div
            key={formError.key}
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm"
          >
            <p className="font-medium text-danger">{formError.text}</p>
            {errorEntries.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
                {errorEntries.map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${FIELD_IDS[field]}`} className="underline underline-offset-2">
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {view === "preview" && previewDesign ? (
        <section aria-labelledby="preview-heading" className="mt-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-soft/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2
                id="preview-heading"
                ref={previewHeadingRef}
                tabIndex={-1}
                className="font-display text-2xl tracking-tight"
              >
                Preview
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                {isPublished
                  ? "This is how the updated design will look to visitors."
                  : "This is how visitors will see the design. Nothing is public until you publish."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setView("edit")}
                disabled={busy}
                className={ui.buttonSecondary}
              >
                <ArrowLeftIcon /> Keep editing
              </button>
              {isPublished ? (
                <button
                  type="button"
                  onClick={() => save("published")}
                  disabled={actionsDisabled}
                  className={ui.buttonPrimary}
                >
                  {savingAs === "published" ? "Saving…" : "Save changes"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => save("draft")}
                    disabled={actionsDisabled}
                    className={ui.buttonSecondary}
                  >
                    {savingAs === "draft" ? "Saving…" : "Save draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => save("published")}
                    disabled={actionsDisabled}
                    className={ui.buttonAccent}
                  >
                    {savingAs === "published" ? "Publishing…" : "Publish now"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-8">
            <p className={`${ui.eyebrow} text-ink-soft`}>In the gallery</p>
            <div className="mt-3 w-full max-w-[15rem]">
              <DesignCard design={previewDesign} index={0} interactive={false} />
            </div>
          </div>

          <div className="mt-10">
            <p className={`${ui.eyebrow} text-ink-soft`}>Design page</p>
            <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-paper">
              <DesignDetail design={previewDesign} headingLevel="h3" interactive={false} />
            </div>
          </div>
        </section>
      ) : (
        <form onSubmit={(event) => event.preventDefault()} noValidate className="mt-6">
          <p className="text-sm text-ink-soft">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section aria-labelledby="images-heading" className="space-y-8">
              <SectionHeading id="images-heading" step={1} title="Images" />
              <ImageField
                inputId={FIELD_IDS.image}
                label="Design image"
                required
                hint="The artwork on its own. A PNG with a transparent background works best."
                slot={imageSlot}
                error={fieldErrors.image ?? (imageSlot.state !== "uploading" ? imageSlot.error : undefined)}
                disabled={busy}
                onFile={(file) => handleFile("design", file)}
              />
              <ImageField
                inputId={FIELD_IDS.mockup}
                label="T-shirt mockup"
                hint="Optional. A picture of the design on a shirt."
                slot={mockupSlot}
                error={fieldErrors.mockup ?? (mockupSlot.state !== "uploading" ? mockupSlot.error : undefined)}
                disabled={busy}
                onFile={(file) => handleFile("mockup", file)}
                onRemove={removeMockup}
              />
            </section>

            <section aria-labelledby="details-heading" className="space-y-6">
              <SectionHeading id="details-heading" step={2} title="Details" />

              <Field id={FIELD_IDS.title} label="Title" required error={fieldErrors.title}>
                {(describedBy) => (
                  <input
                    id={FIELD_IDS.title}
                    value={fields.title}
                    maxLength={LIMITS.title}
                    aria-required
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={describedBy}
                    onChange={(event) => updateField("title", event.target.value)}
                    className={`${ui.input} mt-2`}
                  />
                )}
              </Field>

              <Field
                id={FIELD_IDS.subject}
                label="Subject"
                required
                hint="Used for the gallery filters, for example Biology or Computer Science."
                error={fieldErrors.subject}
              >
                {(describedBy) => (
                  <>
                    <input
                      id={FIELD_IDS.subject}
                      value={fields.subject}
                      maxLength={LIMITS.subject}
                      list="subject-options"
                      autoComplete="off"
                      aria-required
                      aria-invalid={Boolean(fieldErrors.subject)}
                      aria-describedby={describedBy}
                      onChange={(event) => updateField("subject", event.target.value)}
                      className={`${ui.input} mt-2`}
                    />
                    <datalist id="subject-options">
                      {subjectOptions.map((subject) => (
                        <option key={subject} value={subject} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>

              <Field
                id={FIELD_IDS.description}
                label="Short description"
                hint="A few sentences about the idea the design teaches."
                error={fieldErrors.description}
                aside={
                  <span className="font-mono text-xs text-ink-faint">
                    {fields.description.length}/{LIMITS.description}
                  </span>
                }
              >
                {(describedBy) => (
                  <textarea
                    id={FIELD_IDS.description}
                    value={fields.description}
                    maxLength={LIMITS.description}
                    rows={4}
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={describedBy}
                    onChange={(event) => updateField("description", event.target.value)}
                    className={`${ui.input} mt-2 resize-y`}
                  />
                )}
              </Field>

              <Field
                id={FIELD_IDS.altText}
                label="Image description (alt text)"
                required
                hint="One sentence describing the artwork for people who use screen readers. For example: “Illustration of a neuron with the dendrites, axon, and synapse labeled.”"
                error={fieldErrors.altText}
              >
                {(describedBy) => (
                  <textarea
                    id={FIELD_IDS.altText}
                    value={fields.altText}
                    maxLength={LIMITS.altText}
                    rows={2}
                    aria-required
                    aria-invalid={Boolean(fieldErrors.altText)}
                    aria-describedby={describedBy}
                    onChange={(event) => updateField("altText", event.target.value)}
                    className={`${ui.input} mt-2 resize-y`}
                  />
                )}
              </Field>

              {mockupSlot.state !== "empty" && (
                <Field
                  id={FIELD_IDS.mockupAltText}
                  label="Mockup description"
                  hint={`Optional. If left blank: “${mockupAltFallback}”.`}
                  error={fieldErrors.mockupAltText}
                >
                  {(describedBy) => (
                    <input
                      id={FIELD_IDS.mockupAltText}
                      value={fields.mockupAltText}
                      maxLength={LIMITS.altText}
                      aria-invalid={Boolean(fieldErrors.mockupAltText)}
                      aria-describedby={describedBy}
                      onChange={(event) => updateField("mockupAltText", event.target.value)}
                      className={`${ui.input} mt-2`}
                    />
                  )}
                </Field>
              )}

              <details
                className="rounded-xl border border-line bg-card px-4 py-3"
                open={fields.productType !== DEFAULT_PRODUCT_TYPE || Boolean(fieldErrors.productType)}
              >
                <summary className="cursor-pointer text-sm font-medium">More options</summary>
                <div className="mt-4 pb-1">
                  <Field
                    id={FIELD_IDS.productType}
                    label="Product type"
                    hint="Leave this as T-shirt. It's here so other products, like mugs, can be added later."
                    error={fieldErrors.productType}
                  >
                    {(describedBy) => (
                      <input
                        id={FIELD_IDS.productType}
                        value={fields.productType}
                        maxLength={LIMITS.productType}
                        placeholder={DEFAULT_PRODUCT_TYPE}
                        aria-invalid={Boolean(fieldErrors.productType)}
                        aria-describedby={describedBy}
                        onChange={(event) => updateField("productType", event.target.value)}
                        className={`${ui.input} mt-2`}
                      />
                    )}
                  </Field>
                </div>
              </details>
            </section>
          </div>

          <div
            id={FIELD_IDS.status}
            className="sticky bottom-0 z-10 -mx-4 mt-10 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-card sm:px-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                {isPublished ? (
                  <>
                    <button
                      type="button"
                      onClick={openPreview}
                      disabled={actionsDisabled}
                      className={ui.buttonSecondary}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => save("draft")}
                      disabled={actionsDisabled}
                      className={ui.buttonSecondary}
                    >
                      {savingAs === "draft" ? "Unpublishing…" : "Unpublish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => save("published")}
                      disabled={actionsDisabled}
                      className={ui.buttonPrimary}
                    >
                      {savingAs === "published" ? "Saving…" : "Save changes"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => save("draft")}
                      disabled={actionsDisabled}
                      className={ui.buttonSecondary}
                    >
                      {savingAs === "draft" ? "Saving…" : "Save draft"}
                    </button>
                    <button
                      type="button"
                      onClick={openPreview}
                      disabled={actionsDisabled}
                      className={ui.buttonAccent}
                    >
                      Preview &amp; publish
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isNew && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <p className="text-sm text-ink-soft">
                Deleting removes this design and its images from the site permanently.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                disabled={busy}
                className={ui.buttonSmallDanger}
              >
                Delete this design
              </button>
            </div>
          )}
        </form>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete “${design.title || "this design"}”?`}
        description="This permanently removes the design and its images from the site. It can't be undone."
        confirmLabel="Delete design"
        pendingLabel="Deleting…"
        pending={isDeleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function SectionHeading({ id, step, title }: { id: string; step: number; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 border-b border-line pb-3 font-display text-xl">
      <span className="font-mono text-xs text-accent">0{step}</span>
      {title}
    </h2>
  );
}

function Field({
  id,
  label,
  required = false,
  hint,
  error,
  aside,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  aside?: React.ReactNode;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={ui.label}>
          {label}
          {required && (
            <span aria-hidden="true" className="text-danger">
              {" "}
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className={ui.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function ImageField({
  inputId,
  label,
  required = false,
  hint,
  slot,
  error,
  disabled,
  onFile,
  onRemove,
}: {
  inputId: string;
  label: string;
  required?: boolean;
  hint: string;
  slot: Slot;
  error?: string;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const uploading = slot.state === "uploading";
  const ready = readyImage(slot);
  const previewUrl = slot.state === "uploading" ? slot.previewUrl : (ready?.url ?? null);
  const locked = disabled || uploading;
  const percent = slot.state === "uploading" ? Math.round(slot.progress * 100) : 0;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div>
      <label htmlFor={inputId} className={ui.label}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-soft"> (optional)</span>
        )}
      </label>
      <p id={hintId} className={ui.hint}>
        {hint}
      </p>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!locked) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !locked) onFile(file);
        }}
        className={`relative mt-3 overflow-hidden rounded-2xl border-2 border-dashed bg-card transition has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30 ${
          dragging ? "border-accent bg-accent-soft/60" : error ? "border-danger/50" : "border-line hover:border-ink-faint"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          disabled={locked}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
          className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />

        {previewUrl ? (
          <div className="bg-checker flex h-64 items-center justify-center sm:h-72">
            {/* eslint-disable-next-line @next/next/no-img-element -- local or temporary private preview */}
            <img
              src={previewUrl}
              alt=""
              className={`max-h-full max-w-full object-contain p-4 transition ${uploading ? "opacity-50" : ""}`}
            />
          </div>
        ) : ready ? (
          <p className="flex h-40 items-center justify-center px-6 text-center text-sm text-ink-soft">
            The saved image can&apos;t be shown right now, but it&apos;s still stored. Choose a file to
            replace it.
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UploadIcon className="size-5" />
            </span>
            <p className="font-medium">
              Drop an image here, or{" "}
              <span className="text-accent underline underline-offset-2">choose a file</span>
            </p>
            <p className="text-sm text-ink-soft">PNG, JPEG, or WebP · up to {MAX_IMAGE_LABEL}</p>
          </div>
        )}
      </div>

      {slot.state === "uploading" && (
        <div className="mt-3">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">Uploading {slot.fileName}…</span>
            <span className="font-mono">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label={`Uploading ${slot.fileName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {ready && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="flex min-w-0 items-center gap-1.5 text-ink-soft">
            {ready.uploadedName ? (
              <>
                <CheckIcon className="size-4 shrink-0 text-success" />
                <span className="truncate">Uploaded {ready.uploadedName}</span>
              </>
            ) : (
              <span>Current image</span>
            )}
            {ready.width && ready.height ? (
              <span className="shrink-0 font-mono text-xs text-ink-faint">
                · {ready.width}×{ready.height}px
              </span>
            ) : null}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={locked}
              className={ui.buttonSmall}
            >
              Replace
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={locked}
                className={ui.buttonSmallDanger}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {slot.state === "uploading"
          ? `Uploading ${slot.fileName}.`
          : ready?.uploadedName
            ? `${ready.uploadedName} uploaded.`
            : ""}
      </p>
      {error && (
        <p id={errorId} role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
