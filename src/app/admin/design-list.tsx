"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { ui } from "@/components/ui";
import type { DesignStatus } from "@/lib/designs/rules";
import {
  deleteDesign,
  moveDesign,
  setDesignStatus,
  type ActionResult,
} from "./actions";

export type DesignListItem = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  productType: string;
  status: DesignStatus;
  thumbnailUrl: string | null;
};

type Message = { tone: "success" | "error"; text: string };

export function DesignList({ items }: { items: DesignListItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [toDelete, setToDelete] = useState<DesignListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(item: DesignListItem, action: () => Promise<ActionResult>, success: string) {
    setBusyId(item.id);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      setMessage(
        result.ok ? { tone: "success", text: success } : { tone: "error", text: result.error },
      );
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const item = toDelete;
    setBusyId(item.id);
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteDesign(item.id);
      setBusyId(null);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      setToDelete(null);
      setMessage({ tone: "success", text: `Deleted “${item.title}”.` });
    });
  }

  return (
    <>
      <div aria-live="polite">
        {message && (
          <p
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              message.tone === "success"
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.map((item, index) => {
          const busy = busyId === item.id;
          return (
            <li
              key={item.id}
              aria-busy={busy}
              className={`flex flex-col gap-4 p-4 transition sm:flex-row sm:items-center ${busy ? "opacity-60" : ""}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="bg-checker size-20 shrink-0 overflow-hidden rounded-xl border border-line">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- temporary private link
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="size-full object-contain p-1.5"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="font-medium [overflow-wrap:anywhere]">{item.title}</h2>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {item.subject} · {item.productType}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label={`Display order for ${item.title}`}
                  className="flex overflow-hidden rounded-full border border-line"
                >
                  <button
                    type="button"
                    disabled={index === 0 || busyId !== null}
                    onClick={() =>
                      run(item, () => moveDesign(item.id, "up"), `Moved “${item.title}” up.`)
                    }
                    className="px-2.5 py-1.5 transition hover:bg-white disabled:opacity-30"
                  >
                    <ArrowUpIcon />
                    <span className="sr-only">Move {item.title} earlier</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1 || busyId !== null}
                    onClick={() =>
                      run(
                        item,
                        () => moveDesign(item.id, "down"),
                        `Moved “${item.title}” down.`,
                      )
                    }
                    className="border-l border-line px-2.5 py-1.5 transition hover:bg-white disabled:opacity-30"
                  >
                    <ArrowDownIcon />
                    <span className="sr-only">Move {item.title} later</span>
                  </button>
                </div>

                <Link href={`/admin/designs/${item.id}`} className={ui.buttonSmall}>
                  Edit<span className="sr-only"> {item.title}</span>
                </Link>

                {item.status === "published" ? (
                  <>
                    <Link href={`/designs/${item.slug}`} target="_blank" className={ui.buttonSmall}>
                      View<span className="sr-only"> {item.title} (opens in a new tab)</span>
                    </Link>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() =>
                        run(
                          item,
                          () => setDesignStatus(item.id, "draft"),
                          `“${item.title}” is now a draft and hidden from the portfolio.`,
                        )
                      }
                      className={ui.buttonSmall}
                    >
                      Unpublish<span className="sr-only"> {item.title}</span>
                    </button>
                  </>
                ) : (
                  <Link
                    href={`/admin/designs/${item.id}?view=preview`}
                    className={ui.buttonSmall}
                  >
                    Preview &amp; publish<span className="sr-only"> {item.title}</span>
                  </Link>
                )}

                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(item);
                  }}
                  className={ui.buttonSmallDanger}
                >
                  Delete<span className="sr-only"> {item.title}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-sm text-ink-soft">
        The arrows set the order designs appear in on the portfolio.
      </p>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.title ?? ""}”?`}
        description="This permanently removes the design and its images from the site. It can't be undone."
        confirmLabel="Delete design"
        pendingLabel="Deleting…"
        pending={busyId !== null && busyId === toDelete?.id}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
