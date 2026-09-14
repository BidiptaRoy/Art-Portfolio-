import type { DesignStatus } from "@/lib/designs/rules";

const STYLES: Record<DesignStatus | "new", { label: string; className: string }> = {
  published: { label: "Published", className: "bg-success-soft text-success" },
  draft: { label: "Draft", className: "bg-warning-soft text-ink-soft" },
  new: { label: "Not saved", className: "bg-paper-deep text-ink-soft" },
};

export function StatusBadge({ status }: { status: DesignStatus | "new" }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}
