# Surfaces

Read only the section matching `env.project.platform` and the target's mode.

## Web: landing / marketing (Persuade, Experience)

- Triage: `triage.mjs <src> <dev-url>` (no `--app`).
- Diagnose: audit + critique + Taste `inspect.mjs` (page rules) at 1440/768/390.
- Lead designer: **Taste page run**. UUPM: CTA affordance, form flow, nav. Impeccable: audit + anti-slop backup.
- Gate: `gate.mjs check --strict` for restyle/redesign.
- UUPM role: `--domain landing` for section order when the page's argument is unclear; `--domain ux` for P1 rationale.
- Watch for: thin sections, stock hero → logos → 3 cards → CTA sequence, invented proof (testimonials, logos, stats). Taste forbids invented proof; so does this skill.

## Web: app / dashboard / admin (Operate)

Next.js App Router apps, trackers, management tools, marketplaces' signed-in side.

- Triage: `triage.mjs <src> <dev-url> --app`. App mode relaxes Taste rules that are normal in apps (borders, small labels, repeated panels) and adds `placeholder-data` and `framework-colour` checks.
- Diagnose: audit (weight a11y + responsive), critique on the most-used screen first, Taste `inspect.mjs --app`.
- Lead designer: **Taste `draw.mjs --app`** (app styles from real product screens). UUPM owns tables, filters, forms, empty/loading/error states, keyboard flow.
- UUPM role: `--domain chart` for chart type per dataset; `--stack nextjs|react|shadcn` for implementation; `--design-system --density 8` only to borrow a spacing scale, not colours.
- Watch for: KPI tiles with icons in tinted circles, gradient area charts, zebra tables, "Welcome back 👋", Tailwind default blue as brand, lorem or "John Doe" data, colour on chrome instead of data.
- Auth-gated screens: the user must run the dev server and sign in, or provide a seeded route. Never enter real credentials.

## Mobile: Expo / React Native (`mobile`, `mobile+web`)

The detector, Taste lint and Taste inspect are **web-only**. Do not run them on native code.

- Triage: skip `triage.mjs` for `mobile`. For `mobile+web`, triage the web build's URL as a coarse proxy (layout and contrast only; native components may render differently) and label findings "web-proxy".
- Diagnose: `/impeccable audit` routes itself to `audit.native.md` when its context reports `ios`/`android`/`adaptive`; critique runs without the detector on native. UUPM `--stack react-native` and `--domain web` (safe areas, `accessibilityLabel`, touch feedback, platform navigation).
- Lead designer here: **Impeccable** (backup designer steps up; Taste is web-only). Direction via `shape` → new-work. UUPM still owns UX.
- Evidence: screenshots from Expo Go / simulator the user provides, or Expo web as proxy. Say which.
- Gate: the human gate decides on screenshots + critique. `gate.mjs` tracks iterations only when a web-proxy triage exists; otherwise record the decision in `audit.md` §Iterations by hand.
- Watch for: touch targets < 44pt (iOS) / 48dp (Android), missing safe-area insets, hover-dependent affordances, custom back behaviour, text not scaling with OS font size.

## Desktop: Tauri / Electron (`desktop-tauri`, `desktop-electron`)

The UI is a web renderer, so the full web toolchain applies against the dev server URL (Vite usually `http://localhost:1420` for Tauri, varies for Electron).

- Mode: Operate. Triage and inspect with `--app`.
- Viewports: replace 390 with the app's **minimum window size**; check 1280 and 1920 too. Use `inspect.mjs <url> --app --widths <min>,1280,1920` (Taste accepts `--widths`).
- Lead designer: Taste `draw.mjs --app`; UUPM for keyboard shortcuts, menus, window-size behaviour.
- Desktop-specific checks the scanners don't cover (verify by reading code): window drag region on custom title bars (`data-tauri-drag-region` / `-webkit-app-region: drag`) not swallowing clicks; native menu and keyboard shortcuts present and discoverable; OS dark mode honoured (`prefers-color-scheme`); no web-only patterns (marketing hero, cookie banners, "Sign up" CTAs) inside the app shell; text selectable where users copy values.
