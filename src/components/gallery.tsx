"use client";

import { useMemo, useState } from "react";
import type { DisplayDesign } from "@/lib/designs/display";
import { DesignCard } from "./design-card";

// Filters only help once there is a real choice to make.
const MIN_DESIGNS_FOR_FILTERS = 4;
const MIN_SUBJECTS_FOR_FILTERS = 2;

type SubjectCount = { name: string; count: number };

function countSubjects(designs: DisplayDesign[]): SubjectCount[] {
  const counts = new Map<string, SubjectCount>();
  for (const design of designs) {
    const key = design.subject.toLowerCase();
    const entry = counts.get(key) ?? { name: design.subject, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

type Props = {
  designs: DisplayDesign[];
  initialSubject: string | null;
};

export function Gallery({ designs, initialSubject }: Props) {
  const subjects = useMemo(() => countSubjects(designs), [designs]);
  const showFilters =
    designs.length >= MIN_DESIGNS_FOR_FILTERS &&
    subjects.length >= MIN_SUBJECTS_FOR_FILTERS;

  const [active, setActive] = useState<string | null>(() => {
    if (!showFilters || !initialSubject) return null;
    const match = subjects.find(
      (subject) => subject.name.toLowerCase() === initialSubject.toLowerCase(),
    );
    return match?.name ?? null;
  });

  const visible = active
    ? designs.filter((design) => design.subject.toLowerCase() === active.toLowerCase())
    : designs;

  function choose(subject: string | null) {
    setActive(subject);
    const url = new URL(window.location.href);
    if (subject) url.searchParams.set("subject", subject);
    else url.searchParams.delete("subject");
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      {showFilters && (
        <div
          role="group"
          aria-label="Filter designs by subject"
          className="mb-8 flex flex-wrap gap-2"
        >
          <FilterButton pressed={active === null} onClick={() => choose(null)}>
            All <Count value={designs.length} pressed={active === null} />
          </FilterButton>
          {subjects.map((subject) => (
            <FilterButton
              key={subject.name}
              pressed={active === subject.name}
              onClick={() => choose(subject.name)}
            >
              {subject.name}{" "}
              <Count value={subject.count} pressed={active === subject.name} />
            </FilterButton>
          ))}
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {active
          ? `Showing ${visible.length} ${visible.length === 1 ? "design" : "designs"} about ${active}.`
          : ""}
      </p>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 lg:gap-x-8 lg:gap-y-12">
        {visible.map((design) => (
          <li key={design.id}>
            <DesignCard design={design} index={designs.indexOf(design)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        pressed
          ? "border-ink bg-ink text-paper"
          : "border-line bg-card text-ink hover:border-ink-faint"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ value, pressed }: { value: number; pressed: boolean }) {
  return (
    <span className={`ml-0.5 font-mono text-xs ${pressed ? "text-paper/70" : "text-ink-faint"}`}>
      {value}
    </span>
  );
}
