# Handoffs

Every handoff is a short packet: **target, mode, task, files to read, what to return**. Paths, never pasted contents. The sub-skill loads its own references.

## Install (when preflight reports MISSING)

| Skill | Claude Code plugin | CLI / manual |
|---|---|---|
| Taste | `/plugin marketplace add Leonxlnx/taste-skill` · `/plugin install taste-skill@taste-skill` | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| UI UX Pro Max | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` · `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` | `npm i -g uipro-cli && uipro init --ai claude` |
| Impeccable | `/plugin marketplace add pbakaus/impeccable`, then install from `/plugin` | `npx impeccable install` (project root; also installs its design hook) |

Install UUPM from upstream `nextlevelbuilder`. Runtimes: Taste needs Node 22+ and Chrome/Edge/Chromium; UUPM needs Python 3; Impeccable ships its own binary. Re-run preflight afterwards.

Skill-tool names depend on install method: `design-taste-frontend` or `taste-skill:design-taste-frontend`; `ui-ux-pro-max` or `ui-ux-pro-max:ui-ux-pro-max`; `impeccable`. Use what the session's skill list shows.

## Ownership (identical to `gate.mjs`)

Every finding has a **kind**, a **primary owner**, and a **backup**. The gate escalates owner → backup → human when a finding survives an iteration.

| Kind | Matches (rule ids) | Owner → backup | Owner action | Backup action (Impeccable) |
|---|---|---|---|---|
| a11y | contrast, gray-on, touch, target, focus, alt, heading, label, aria, reduced-motion, zoom, keyboard | **UUPM** → Impeccable | `search.py "<outcome>" --domain ux -n 2`, then `--stack <stack>`; implement the guideline | `colorize` (contrast) · `adapt` (touch/viewport) · `polish` (focus/states) |
| ux | form, nav, error, empty, overflow, scroll, breakpoint, responsive, gesture, link, button, state | **UUPM** → Impeccable | same as a11y | `harden` · `adapt` · `clarify` |
| perf | perf, layout-thrash, cls, bundle, lazy, will-change | **UUPM** → Impeccable | `--domain react -n 2` or `--stack <stack>` | `optimize` |
| slop | gradient, eyebrow, shadow, glass, mono, font, side-tab, badge, pill, card, emoji, blob, glow, accent-word, index-number, hairline, outlined, bounce, em-dash, copy, framework-colour, placeholder | **Taste** → Impeccable | Re-apply house rules in the files; if structural, `--redraw` the slot that produced it | `quieter` · `distill` · `typeset` |
| visual | everything else (Taste inspect frame/type/motion measures: headline-lines, margins, blank stretches, font-not-dealt, motion count, scenes) | **Taste** → Impeccable | Fix against the dealt sheet (`draw.mjs --show`); redraw only if the sheet caused it | `layout` · `typeset` |

Group by owner, then by command: one invocation per command with all its files. Order per iteration: **Taste → UUPM → Impeccable**.

## Packets

**Taste, fix pass** (Skill: design-taste-frontend)
> Mode <mode>, target <files>. Direction sheet: `draw.mjs --show` (or none yet → follow your "component or single section" special case). Fix only: <rule ids> (evidence `.meticulous/triage.json`, `--explain <rule>` for detail). Keep content, stack and behaviour. Return: files changed, any redraw + reason.

**UUPM, UX pass** (Skill: ui-ux-pro-max, or call `search.py` directly)
> One query per finding, `-n 2`. Verify the top result matches the product and platform; retry once narrower; if still no match, say so and use the built-in priority table, labelled as fallback. Implement the guideline in <files>. Never take colours or fonts from its output.

**Impeccable, backup pass**
> `/impeccable <command> <files>` — Mode <mode>. Taste/UUPM already attempted: <rule ids> persisted. Fix only these as an anti-AI-slop pass; keep the dealt direction (DESIGN.md / `draw.mjs --show`). Change nothing else.

**Impeccable, audit** (Phase 3 and loop re-audit)
> `/impeccable audit <files>`. Evidence: `.meticulous/triage.json`. Return the five scores and P1 list. (Critique gets target + mode only.)

## Restyle (Taste leads)

1. `node <taste>/scripts/draw.mjs --sector <s> --brief "<one line>" --sections <roles> --keep <pinned: palette,type> --options 3`, choose against the subject inventory, then deal the full sheet with `--direction <id>`.
   Operate: `draw.mjs --app --kind <kind> --brief "<one line>" --keep <pinned> --options 3`, then `--style <id>` (`--app --list kinds`: finance, analytics, devtools, smb-admin, support, workspace, …).
2. Apply type, colour, components; keep layout, routes, data.
3. UUPM: states and interaction of the restyled components (hover/focus/loading/error/empty), one query each.
4. Impeccable: `quieter` or `distill` only on what lint still flags.

## Redesign (Taste leads; run in a subagent)

Tell the human first: *"Redesign runs Taste's full build, roughly 30–45 minutes and a few hundred thousand tokens per surface. Proceed?"*

```
Use the design-taste-frontend skill on <target> (<page run | app-screens run>).
Project root <root>. Stack <stack>; keep it, no framework or styling migration.
Product truth: PRODUCT.md. Pinned brand values: DESIGN.md (pass --keep <palette,type> if listed).
Before-state already inspected: .meticulous/before/ (skip your before pass).
Defects to resolve: .meticulous/audit.md §Findings.
Human direction (if a loop): .meticulous/next.json humanNote + areas.
Allowed exceptions (inspect --allow): <from conflicts.md, or none>.
Return only: direction id + seed, redraws + reasons, idea sentence, inspect FAIL/WARN at each width,
critique score, sample content and found images to replace.
```

Then in the main context: UUPM UX review of the new flows (one query per flow concern), Impeccable anti-slop pass on lint leftovers, Phase 6 gate.

## Native mobile (Impeccable leads as backup designer)

Taste does not run. `/impeccable shape <screen>` → new-work (Impeccable deals the world) → `adapt` → `polish`. UUPM supplies UX: `--stack react-native`, `--domain web` (safe areas, `accessibilityLabel`, touch feedback, navigation). The gate runs on screenshots the human supplies or an Expo web proxy; `gate.mjs` still tracks iterations from triage of the web proxy when available, otherwise the human gate decides on screenshots and critique alone.

## Loop pass (from `next.json`)

1. `reaudit`: run exactly what it lists (triage always; audit scoped; critique only if flagged).
2. `work`: execute packets per owner in `order`. Area items map to Taste redraws: `hero | type | palette | photos | scenes | direction | section:<role>`; `generic` → Taste redraw of the weakest slot named in the last critique, then Impeccable anti-slop; `ux` → UUPM flow review.
3. `stuck`: do not touch unless the human named their area or accepted them.
4. Back to the gate.
