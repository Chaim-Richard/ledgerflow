import React from "react";
import { CHART_KINDS, type ChartKind } from "../../hooks/useChartKind";

export default function ChartKindPicker({
  title,
  kind,
  onChange,
}: {
  title: string;
  kind: ChartKind;
  onChange: (kind: ChartKind) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`${title} chart style`}
      className="flex flex-wrap gap-2"
    >
      {CHART_KINDS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={kind === value}
          onClick={() => onChange(value)}
          className="min-h-11 min-w-11 px-3 border border-[var(--line)] rounded-lg text-[var(--text)] bg-[var(--panel)] aria-pressed:bg-[var(--ink)] aria-pressed:font-semibold"
        >
          {value === "bar" ? "Bar" : value === "line" ? "Line" : "Area"}
        </button>
      ))}
    </div>
  );
}
