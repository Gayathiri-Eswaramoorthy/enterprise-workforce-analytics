import React from "react";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  dot?: string;
}

/** Checkbox facet with counts; an empty selection means "all". */
export const FacetGroup: React.FC<{
  title: string;
  allLabel: string;
  total: number;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}> = ({ title, allLabel, total, options, selected, onToggle, onClear }) => {
  const row = (key: string, label: React.ReactNode, count: number, checked: boolean, onChange: () => void) => (
    <label key={key} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 flex-shrink-0 rounded border-rule-strong accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-ink-3">{count}</span>
    </label>
  );
  return (
    <fieldset className="border-t border-rule pt-4">
      <legend className="float-left mb-1 w-full text-[13px] font-semibold text-ink">{title}</legend>
      <div className="clear-both">
        {row("all", allLabel, total, selected.size === 0, onClear)}
        {options.map((o) =>
          row(
            o.value,
            <span className="flex items-center gap-2">
              {o.dot && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: o.dot }} />}
              {o.label}
            </span>,
            o.count,
            selected.has(o.value),
            () => onToggle(o.value),
          ),
        )}
      </div>
    </fieldset>
  );
};

export const toggled = (set: Set<string>, value: string) => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};
