---
name: Workforce Analytics
description: Attrition risk, skill gaps, and retention actions for HR teams.
colors:
  navy: "#0b1f44"
  navy-ink: "#f1f5ff"
  navy-ink-2: "#c5d2ea"
  navy-muted: "#9baed2"
  ground: "#f6f8fb"
  panel: "#ffffff"
  sunken: "#f1f4f9"
  hover: "#f5f8fc"
  accent-soft: "#eef3fe"
  ink: "#0c1a33"
  ink-2: "#3f4e68"
  ink-3: "#5b6b84"
  rule: "#e3e8ef"
  rule-strong: "#cbd5e1"
  rule-soft: "#edf1f6"
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
  accent-ring: "#bfd3fb"
  link: "#1d4ed8"
  signal: "#06b6d4"
  risk-low: "#1ec47f"
  risk-medium: "#eda312"
  risk-high: "#f25a2a"
  risk-critical: "#d0216e"
typography:
  figure:
    fontFamily: "Public Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  section-title:
    fontFamily: "Public Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Public Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  table:
    fontFamily: "Public Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "Public Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  segment: "3px"
  control: "8px"
  card: "10px"
  pill: "9999px"
spacing:
  row-comfortable: "60px"
  row-compact: "44px"
  card-x: "24px"
  gap: "24px"
components:
  card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
    padding: "24px"
  button:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  tile-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  table-header:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-2}"
    height: "40px"
  nav-item:
    textColor: "{colors.navy-ink-2}"
    rounded: "6px"
    height: "36px"
  nav-item-active:
    textColor: "#ffffff"
---

# Design System: Workforce Analytics

## Overview

**Creative North Star: "The Plain-Spoken Console"**

A standard, calm enterprise SaaS interface. A flat navy rail frames a cool near-white page; content sits on white
cards with 1px borders. One blue accent does every interactive job, and the four-step risk scale is the only other
colour. Nothing is decorative: depth is a border plus one hairline shadow, motion is state feedback.

The values are read off real products (public stylesheets and design systems of Vercel, Stripe, GitHub Primer,
Mercury and Linear, and IBM Carbon's table spec): near-white ground, white panels, 1px #e3e8ef-class borders,
navy-tinted ink, 6 to 10px radii, 14/13/12px type, a single 5% hairline shadow, 150ms ease-out transitions.
The user directed this after rejecting an earlier neumorphic/skeuomorphic pilot: professional, neat, simple,
properly arranged, keeping navy and blue and a proper table with an S.No column.

**Key Characteristics:**
- White cards on a #f6f8fb ground; borders, not shadows, make the structure.
- One blue accent; cyan only in the re-score sweep.
- Risk scale beside its label, never alone.
- A real data table: S.No, sortable headers, search, density, pagination.
- Real-product motion: colour transitions, one grow-in, one sweep, view-transition reflow.

## Colors

### Primary
- **Navy** (navy): the navigation rail and the page-dim scrim; text on it uses navy-ink (14.9:1), navy-ink-2
  (10.7:1) and navy-muted (7.3:1).
- **Accent Blue** (accent, accent-hover): primary buttons, the nav user avatar, skill bars, the notification count.
  White on accent is 5.2:1. **Link Blue** (link, 6.7:1 on white): links, sort arrows, selected labels.
  **Accent Soft / Accent Ring**: selected tiles, department rows, chips and the current page key.

### Secondary
- **Signal Cyan** (signal): the sweep along the distribution bar while the model re-scores. Nowhere else.

### Neutral
- **Ground** (ground) page; **Panel** (panel) cards, top bar; **Sunken** (sunken) table header, bar tracks,
  segmented-control track, skeletons; **Hover** (hover) row and tile hover.
- **Ink / Ink 2 / Ink 3**: text at 17.3:1, 8.4:1 and 5.4:1 on white.
- **Rule / Rule Soft / Rule Strong**: card and header borders, row dividers, control borders.

### Status: the risk scale (fixed)
Emerald, amber, orange-red, raspberry (risk-low to risk-critical), validated with the dataviz palette checker on white:
lightness band, chroma floor, colour-vision-deficiency and normal-vision separation pass (amber and emerald sit in
the 6 to 8 tritan floor band, legal because every level is labelled). Under 3:1 on white for low and medium, so labels
are mandatory.

### Named Rules
**The One Accent Rule.** Blue is the only interactive colour. Cyan appears only in the re-score sweep.
**The One Signal Rule.** Risk colours appear only where risk is the content: bars, meters, level tiles.
**The Label Rule.** A risk colour always sits beside its level in words.

## Typography

**Font:** Public Sans Variable (self-hosted, weights 100 to 900), with the system sans as fallback.

**Character:** Neutral and sturdy; hierarchy comes from size and weight steps, not from width or colour.

### Hierarchy
- **Figure** (600, 44px phone / 52px desktop, -0.035em, tabular while counting): the headline count only.
- **Section title** (600, 15px): card headings and the top-bar page title.
- **Body** (400, 14px/1.5). **Table and controls** (13px). **Meta and column headers** (12px; headers 600).
- Sentence case everywhere, including "S.No" and "Open actions".

### Named Rules
**The Aligned Numbers Rule.** `tabular-nums` only where numbers align vertically: S.No, risk percentages, open
actions, page keys, and the figure while it counts.

## Layout

- Shell: 240px navy rail (off-canvas drawer below `lg`), 56px white top bar with a bottom border, content max
  1360px, 32px side padding on desktop and 16px on phones, 24px between cards.
- Overview: from `xl`, a summary card (8 columns) beside "By department" (4 columns), equal height; then the full
  table card; then actions (7) beside skill gaps (5) from `lg`. Below `xl` everything stacks.
- The four level tiles run 4 across from `sm`, 2 across on phones.
- The table is a grid from `md`: `3.5rem` S.No, flexible employee, department (from `xl`), `12.5rem` risk, flexible
  drivers, `7.5rem` open actions, chevron. Below `md` it becomes a stacked list; nothing scrolls sideways.

## Elevation & Depth

Flat with a hairline. Cards are white with a 1px rule border and `0 1px 2px rgb(12 26 51 / 0.05)`. The only larger
shadow token (`0 8px 24px rgb(12 26 51 / 0.12)`) is reserved for floating menus. There are no inset shadows,
gradients or glows. Only the segmented control's moving thumb borrows the card shadow.

### Named Rules
**The Hairline Rule.** Structure comes from 1px borders; a shadow never exceeds the hairline except on a floating layer.

## Shapes

10px cards, 8px buttons, inputs and tiles, 6px nav items and sort buttons, 4px and 3px for bar and segment ends,
full pills only for meters, the count, avatars and bar tracks.

## Components

### Buttons
White, 1px rule-strong border, 36px high, 13px medium, hairline shadow; hover fills sunken in 150ms. The primary
button is solid accent with white text, one per surface ("Re-score everyone"). Inline row actions: an outlined
"Accept" in link blue and a plain "Dismiss", so repeated rows never stack filled buttons.

### Level tiles (signature)
Four bordered tiles under the distribution bar: dot, level, count (28px, 600) and share. Pressed tiles take the
accent border and accent-soft fill and mean "this level is in the table"; they also dim the bar segments of the
levels that are off. Hover: sunken border and fill.

### Distribution bar
A 12px bar (6px in department rows), 3px segment radius, 3px gaps (2px small). Segments grow in from the left once
on load, the flex-grow transitions when data changes, and a cyan sweep runs along it while the model re-scores.

### Data table
- Toolbar: title, a grey count pill, filter chips, a bordered search field, a two-position density control.
- Header: a full-width sunken band, 40px, 12px semibold labels; sortable columns are buttons with `aria-sort`, the
  active one shows a link-blue arrow, others reveal a hint on hover.
- Rows: 60px comfortable, 44px compact; 1px soft dividers; hover fills hover and nudges the chevron; the whole
  row is a link; keyboard focus rings the row. Employee cell: an accent-soft initials disc, name, role.
- Footer: "Showing 1 to 10 of N" and bordered page keys, the current one in accent-soft.
- Filtering, sorting and paging reflow rows through a view transition (320ms, ease-out-expo).

### Navigation
Flat navy rail grouped by job (Retention, Talent, Admin), 36px items, 6px radius. A white-at-12% highlight slides
(300ms) to the active item. The signed-in user sits above a 1px divider at the bottom.

## Do's and Don'ts

### Do:
- **Do** separate with borders and spacing; keep every shadow at the hairline.
- **Do** keep one blue accent and put the risk scale only where risk is the content.
- **Do** pair every risk colour with its level in words.
- **Do** filter, sort and page through view transitions, and honour reduced motion.

### Don't:
- **Don't** reintroduce inset or dual shadows, gradients, gel or LED effects.
- **Don't** add KPI card rows, donuts or a decorative chart where a sentence or a bar says it.
- **Don't** use all-caps labels, eyebrows above headings, or side-stripe borders.
- **Don't** stack filled primary buttons in repeated rows.
