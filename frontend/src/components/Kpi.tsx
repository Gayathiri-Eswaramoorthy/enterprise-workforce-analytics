import React from "react";

/** Summary tile: tinted round icon, label, big number and an optional note. Raised, lifts on hover. */
export const Kpi: React.FC<{
  icon: React.ElementType;
  tone?: string;
  label: string;
  value: number | string;
  note?: string;
}> = ({ icon: Icon, tone, label, value, note }) => (
  <div className="card-raised card-lift flex items-center gap-4 p-5">
    <span
      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
      style={
        tone
          ? {
              color: tone,
              background: `color-mix(in srgb, ${tone} 12%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent)`,
            }
          : { color: "var(--link)", background: "var(--accent-soft)", boxShadow: "inset 0 0 0 1px var(--accent-ring)" }
      }
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-tight tabular-nums text-ink">{value}</span>
        {note && <span className="text-[13px] tabular-nums text-ink-3">{note}</span>}
      </p>
    </div>
  </div>
);
