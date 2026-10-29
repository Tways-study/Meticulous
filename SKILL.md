---
name: meticulous
description: "Orchestrates Taste (lead designer), UI UX Pro Max (UI/UX) and Impeccable (auditor and anti-AI-slop backup designer) into one audit → design → verify loop with a human decision gate, for any web app, dashboard, landing page, Expo/React Native app or Tauri/Electron desktop app. Use when the user asks to audit, review, score, fix, restyle, redesign or 'make this not look AI-generated' across a project or surface, or wants the three design skills run together. Default run audits and stops for a decision; verification always ends at a human gate that approves or loops back."
argument-hint: "[audit|fix|restyle|redesign|verify|gate] [target path, route or URL]"
user-invocable: true
---

# Meticulous

Three specialists, one human with the final say. Meticulous decides **who plays when**, passes work between players **as files, not pasted content**, and never ships without a human decision at the verification gate.

| Player | Role | Owns | Does not |
|---|---|---|---|
| **Taste** | **Lead designer** | Art direction (`draw.mjs`), composition, type, palette, imagery, motion, the frame; house-style lint; browser gate (`inspect.mjs`) | Run on native mobile (web-only) |
| **UI UX Pro Max (UUPM)** | **UI/UX specialist** | Interaction, accessibility how-to, forms, navigation, states, UX patterns, chart choice, stack-correct implementation (`search.py`) | Choose palette or typefaces (its picks conflict with Taste's direction and trip both scanners) |
| **Impeccable** | **Auditor + backup designer (anti-AI-slop)** | Detector, `audit`, `critique`, context files (PRODUCT.md, DESIGN.md); takes over a design or slop fix when Taste's attempt failed, or leads design on native | Deal a visual direction on web (Taste does) |

The human decides at two gates: **which option** (Phase 4) and **whether it ships** (Phase 6). Nothing loops or ships silently.

`<meticulous>` = this skill's folder. `<impeccable>`, `<taste>`, `<uupm>` = skill folders recorded in `.meticulous/env.json` → `skills` (Windows: `<impeccable>/scripts/impeccable.cmd`). All state lives in `.meticulous/`.

## Routing by argument

| Invocation | Runs |
|---|---|
| none / `audit [target]` | Phases 0–4, stop at the option gate |
| `fix` · `restyle` · `redesign [target]` | Phases 0–2 (baseline required), then 5 → 6 (gate loop) → 7. `redesign` states its cost and waits for a yes |
| `verify` / `gate [target]` | Phase 6 against the existing baseline (none → run Phase 2 first and say so) |
| Plain language ("make the dashboard less generic") | Nearest row; if it could be Restyle or Redesign, audit first and let the gate decide |

## Non-negotiables

1. **Design authority is split by domain, not ranked by tool.** Visual decisions → Taste. Interaction and accessibility decisions → UUPM. Evidence of defects and slop → Impeccable. Product facts and pinned brand values in PRODUCT.md / DESIGN.md beat all three. Full rules: `references/conflicts.md`.
2. **Cheapest evidence first.** Scripts before LLM judgment; scoped audit before full critique; Taste slot redraw before full redesign.
3. **Hand off by path.** Target, mode, and file paths (`triage.json`, `next.json`, `audit.md`, DESIGN.md). Never paste their contents.
4. **Sub-skills load their own references.** Invoke via the Skill tool with the exact command; never pre-read their reference files.
5. **One direction dealer.** Taste on web; Impeccable `shape` → new-work on native. Never both in one run.
6. **The loop's memory is on disk.** `gate.mjs` decides what failed and who owns it; follow `next.json`, not recollection of earlier iterations.

## Phase 0 — Preflight (once per session)

`node <meticulous>/scripts/preflight.mjs` → ~6 lines; writes `env.json` (skill paths, stack, platform, context files, `caps`). Missing skill → say which, continue without it, never fake its output (install: `references/handoffs.md`).

Choose the **surface mode** from the target: **Persuade** (landing), **Operate** (app, dashboard, admin, desktop app), **Read** (docs), **Experience** (portfolio). Read only that section of `references/surfaces.md`.

## Phase 1 — Context (Impeccable, as record-keeper)

`<impeccable>/scripts/impeccable context --target <target>`, once.
- No PRODUCT.md + audit only → continue; offer `/impeccable init` at the gate.
- No PRODUCT.md + restyle/redesign → `/impeccable init` first (product truth feeds Taste's brief and inventory).
- Code but no DESIGN.md → `/impeccable document` so the detector can check drift.

## Phase 2 — Triage (zero LLM tokens)

`node <meticulous>/scripts/triage.mjs [target] [dev-url] [--app] --baseline` → merged, ranked table (P1 a11y/defects, P2 slop/house style, P3 advisory), hotspot files, full detail in `triage.json`. **`--baseline` only on the first run of a task**; every later run measures against it. Detail for one rule: `--explain <rule>`.

## Phase 3 — Diagnose

Scope to hotspots and the target.
1. **Impeccable `audit <target>`** (auditor): five technical scores; verifies detector hits, marks false positives. Pass it the `triage.json` path.
2. **Impeccable `critique <target>`** (auditor): heuristic score. Give it the target and mode only. Never the triage table: its design review must finish before detector evidence is seen, and it runs its own isolated sub-agents. Fold its closing question into the Phase 4 gate.
3. **UUPM** (UI/UX): for each P1 or UX finding, one query: `python3 <uupm>/scripts/search.py "<outcome, 2-5 words>" --domain ux -n 2`, then `--stack <stack>` if the fix is framework-specific.
4. **Taste** (lead designer), web with browser only: `inspect.mjs <url> --out .meticulous/before [--app]`. Look at 390 and 1440 first; 768 only if layout breaks between them.

## Phase 4 — Option gate (default run ends here)

Write `.meticulous/audit.md` (`references/report.md`). Ask the human:

| Option | Lead | Support | Cost |
|---|---|---|---|
| **Fix** | UUPM (UX/a11y defects) + Taste (house-style tells) | Impeccable as backup | Low |
| **Polish** | Fix, then `/impeccable polish` on the critique backlog | — | Low–med |
| **Restyle** | Taste `draw.mjs --keep <whatever DESIGN.md pins>`, layout kept | UUPM for states/interaction; Impeccable anti-slop pass | Medium |
| **Redesign** | Taste full run (page run, or its app-screens run for Operate) | UUPM UX review of the new flows; Impeccable anti-slop pass | High (~30–45 min, few 100k tokens per surface) |

Native mobile: Impeccable leads Restyle/Redesign (Taste can't run), UUPM supports. Recommend one option with a one-line reason from the evidence.

## Phase 5 — Design (the chosen option, or `next.json` on a loop)

Order within an iteration: **Taste → UUPM → Impeccable**. Lead design sets the surface, UX corrects behaviour on top of it, and the anti-slop backup cleans what remains. Packets and command mappings: `references/handoffs.md`.

- **First pass:** route each finding by owner (gate.mjs's table in `handoffs.md`). Restyle/Redesign go to Taste with the handoff packet; in Claude Code run a Redesign in a **subagent** so its screenshot loop stays out of the main context.
- **Loop pass:** read `.meticulous/next.json` and do exactly its `work` packets in its `order`, plus its `reaudit` steps. Human words in `humanNote` are the brief for this pass. A rejected area maps to a Taste `--redraw <slot>`; record each redraw and its reason.
- Impeccable reads its own `craft-floor.md` before edits. No framework or styling-library migrations.

## Phase 6 — Verify and human gate (loops until the human closes it)

```bash
node <meticulous>/scripts/triage.mjs [target] [dev-url] [--app]          # no --baseline
node <taste>/scripts/inspect.mjs <url> --out .meticulous/after [--app] [--allow <rule>]
node <meticulous>/scripts/gate.mjs check [--strict]                      # --strict for restyle/redesign
```

`gate.mjs check` computes the automated verdict (no regressions vs baseline, P1 = 0, Taste FAIL = 0; with `--strict` open P2 slop also blocks), routes each failure to its owner, and **escalates** a failure that survived the previous iteration: owner → backup (Impeccable) → **stuck** (human call). It prints a gate card.

**Show the human the evidence, then ask.** Send the gate card, the before/after screenshots at 390 and 1440 (or the native screenshots they provided), and a one-line recommendation. Ask with one question (AskUserQuestion when available):

| Choice | When | Record |
|---|---|---|
| **Approve** | Verdict PASS and it looks right | `gate.mjs record approve` → Phase 7 |
| **Loop: fix what failed** | Verdict FAIL, direction is fine | `gate.mjs record loop [--note "<their words>"]` |
| **Loop: redesign parts** | Looks wrong even if checks pass; ask which areas (hero, type, palette, photos, scenes, section:<role>, direction, ux, generic) | `gate.mjs record redesign --areas <a,b> --note "<their words>"` |
| **Ship anyway** | Remaining failures are acceptable (often stuck items) | `gate.mjs record ship-anyway --note "<why>"` → each open failure becomes a recorded exception |
| **Stop** | Pause here | `gate.mjs record stop` |

A PASS still goes to the human: automated checks prove nothing banned was measured, not that it's good. `approve` is refused on a FAIL verdict; use `ship-anyway` so exceptions are recorded.

**Loop-back is seamless:** `record loop|redesign` writes `next.json` (owners, actions, scoped files, whether to re-critique) and you go straight back to **Phase 3 with only `next.json`'s `reaudit` steps**, then Phase 5 with its `work`, then this gate. Skip Phases 0–2's setup and the option gate; env, context and baseline are reused. Re-critique only when `next.json` says so (visual complaints, named areas, redesign).

**Cost control:** state the iteration number and running cost class at every gate. After iteration 3, recommend Ship anyway or Redesign-parts over another identical loop; stuck items never loop on their own.

## Phase 7 — Record

- Visual system changed → `/impeccable document` so DESIGN.md records Taste's shipped direction (this is how the lead designer's decisions become durable truth for the auditor).
- Accepted exceptions → `impeccable ignores add-value <rule> <value> --reason "<human's reason>"` and Taste `--allow <rule>`; list them in `audit.md`.
- Append the iteration log (`gate.mjs status`) and the result block to `audit.md`. Final message: before → after counts, scores, iterations, exceptions, and any sample content or found imagery to replace (from Taste's report).

## Token discipline

- Script output is the interface; JSON only via `--explain` or `next.json`.
- Loops re-audit **only** `next.json`'s scope: scoped `audit`, critique only when flagged, no full re-triage of unrelated targets.
- One UUPM query per concern, `-n 2`; `-f markdown` if a design system is ever requested (~3 KB vs ~8 KB).
- Screenshots: two widths first, third on demand; batch fixes, then look once.
- Native mobile: no detector, no Taste; see `references/surfaces.md`.

## Files

| File | Read when |
|---|---|
| `references/handoffs.md` | Phase 5 packets, owner table, install commands |
| `references/surfaces.md` | Phase 0, the chosen surface's section only |
| `references/conflicts.md` | Two players disagree |
| `references/report.md` | Phase 4 `audit.md`, Phase 7 result block |
| `scripts/preflight.mjs` · `triage.mjs` · `gate.mjs` | Phases 0 · 2, 6 · 6 |
