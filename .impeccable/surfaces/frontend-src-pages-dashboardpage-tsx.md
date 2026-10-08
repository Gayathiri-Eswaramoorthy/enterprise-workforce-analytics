---
version: 1
slug: "frontend-src-pages-dashboardpage-tsx"
primary_target: "frontend/src/pages/DashboardPage.tsx"
related_targets: ["frontend/src/layouts/Layout.tsx"]
---

# HR Overview (and app shell)

Scope: the HR home route `/` (DashboardPage) plus the shared app shell (Layout). Visitor mode: Operate.

Audience: HR admins and managers at a desk, daily, in a daylit office. Judged by professional designers.
Job: see who is likely to leave, why, and act on the most urgent pending actions without leaving the page.
Constraints: keep all existing data and role behaviour; employees never see this page; one-click demo logins stay on /login (not this surface).
User direction, in order: spruce pilot (rejected as slop) → neumorphism + skeuomorphism in navy and cyan (rejected: "doesn't look good") → fourth round, pinned: "professional look, neat and simple, properly arranged; go scrape real websites and put the design". Kept from earlier rounds: navy and blue palette, a proper table with an S.No column, sort/search/density/pagination, flowing transitions and hover states.
Scraped evidence (public stylesheets and design systems of Vercel, Stripe, GitHub Primer, Mercury, Linear, IBM Carbon, shadcn/ui): cool near-white ground, white panels, 1px borders, tinted navy ink, 6-8px radius, 14/13/12px type, one blue accent, a single 1px 4%-black shadow, 150ms ease-out transitions, Carbon table rows at 40-48px with 14px/600 column headers.

## Direction contract

THESIS: The Overview as a standard, calm enterprise SaaS page: a page header, one summary card that answers "who is likely to leave", one real data table, then actions and skills. Refuses the category default of four equal KPI cards over a donut, and refuses this project's own earlier detour into soft-3D chrome.

OWN-WORLD: Cool near-white ground #F6F8FB, pure-white panels with a 1px #E3E8EF border and one 0 1px 2px 4% shadow, 8px panels and 6px controls. Flat navy rail #0B1F44. Navy-tinted ink #0C1A33. One accent, blue #2563EB (links #1D4ED8), cyan #06B6D4 only for the re-score sweep. Geist Variable at 14/13/12px, weight 600 for headings, sentence case. The vivid risk scale (emerald, amber, orange-red, raspberry) is the only other colour, always beside its label. No gradients, glows, LEDs, or inset shadows.

STORY: HR reads "10 of 50 people are at high or critical risk of leaving", sees the split by level and by department side by side, scopes the table with the level tiles or a department, sorts, searches and pages it, and accepts urgent actions below.

FIRST VIEWPORT: Navy rail 240px (flat sliding highlight on the active item). White 56px top bar. Page content on the ground: left, a white summary card (headline sentence with the count, model status, a flat distribution bar, four level tiles that filter, primary "Re-score everyone" at its top right); right, a "By department" card; both the same height. Below, the full-width "Needs attention" table card: toolbar (title, count, search, density), tinted header row, S.No / Employee / Department / Attrition risk / Main drivers / Open actions, footer with range and pages.

FORM: Pinned by the user; no concept roll. Signature interaction: the level tiles and department rows are the filter, and the table rows flow to their new places through a view transition. Motion is the real-product kind: 150ms colour/background transitions, a bar grow-in and count-up on first load, a cyan sweep across the distribution bar while the model re-scores, a sliding nav highlight, row hover with a chevron nudge, actions that fold away when resolved.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Other routes still use the old visual system until the rollout continues.
- No dark theme: the use scene is a daylit office desk.
