import React from "react";

/** The product mark: a miniature risk strip, low → critical. */
export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 23 7" className={className} aria-hidden="true" focusable="false">
    <rect x="0" width="9" height="7" rx="1.5" fill="var(--risk-low)" />
    <rect x="10.5" width="4.5" height="7" rx="1.5" fill="var(--risk-medium)" />
    <rect x="16.5" width="3" height="7" rx="1.5" fill="var(--risk-high)" />
    <rect x="21" width="2" height="7" rx="1" fill="var(--risk-critical)" />
  </svg>
);
