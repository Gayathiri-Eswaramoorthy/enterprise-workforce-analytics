import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Centered dialog with a blurred backdrop. Closes on Escape and on backdrop click. */
export const Modal: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, wide, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portaled so the backdrop covers the app header too
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgb(12 26 51 / 0.4)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-rule bg-panel p-6 shadow-pop ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-[13px] text-ink-2">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-3 hover:bg-sunken">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-ink-2">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
  </label>
);
