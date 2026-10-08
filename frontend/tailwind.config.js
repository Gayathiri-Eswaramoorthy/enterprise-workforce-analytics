/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: {
          DEFAULT: "var(--shell)",
          ink: "var(--shell-ink)",
          "ink-2": "var(--shell-ink-2)",
          muted: "var(--shell-muted)",
        },
        ground: "var(--ground)",
        panel: "var(--panel)",
        sunken: "var(--sunken)",
        hover: "var(--hover)",
        "accent-soft": "var(--accent-soft)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        rule: {
          DEFAULT: "var(--rule)",
          strong: "var(--rule-strong)",
          soft: "var(--rule-soft)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          ring: "var(--accent-ring)",
        },
        link: "var(--link)",
        focus: "var(--focus)",
        signal: "var(--signal)",
        risk: {
          low: "var(--risk-low)",
          medium: "var(--risk-medium)",
          high: "var(--risk-high)",
          critical: "var(--risk-critical)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
