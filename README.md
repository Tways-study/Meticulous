# Meticulous

An agent skill that runs three design skills — **Taste**, **UI UX Pro Max** and **Impeccable** — as one audit → design → verify loop, with a human deciding at the end of each round.

Use it to audit, fix, restyle or redesign a web app, dashboard, landing page, Expo/React Native app, or Tauri/Electron desktop app. It's also for the "make this not look AI-generated" case.

## How it works

Each player owns one domain:

| Player | Role | Owns |
|---|---|---|
| **Taste** | Lead designer | Art direction, composition, type, palette, imagery, motion; browser gate |
| **UI UX Pro Max** | UI/UX specialist | Interaction, accessibility, forms, navigation, states, stack-correct implementation |
| **Impeccable** | Auditor and backup designer | Slop detection, audit, critique, `PRODUCT.md` / `DESIGN.md`; takes over when Taste's fix fails |

Work moves between them as files in `.meticulous/`, not pasted content. Scripts run before any LLM judgment, so the cheapest evidence comes first.

There are two human gates:

1. **Which option** — after the audit, you pick what to do.
2. **Whether it ships** — after verification, you approve, loop, redesign parts, ship with recorded exceptions, or stop.

If a failure survives an iteration, the gate escalates it from its owner to the backup, then to you.

## Phases

| # | Phase | What happens |
|---|---|---|
| 0 | Preflight | Detects skills, stack, platform; writes `env.json` |
| 1 | Context | Impeccable gathers `PRODUCT.md` / `DESIGN.md` |
| 2 | Triage | Script-only ranked findings (P1 a11y/defects, P2 slop/house style, P3 advisory) |
| 3–4 | Audit and options | Scoped audit, then stop for your decision |
| 5 | Fix | Findings routed to their owners |
| 6 | Verify and gate | Before/after screenshots, gate card, your call |
| 7 | Record | Updates `DESIGN.md`, logs exceptions and the result in `audit.md` |

## Requirements

- Node 22+ and Chrome, Edge or Chromium (Taste)
- Python 3 (UI UX Pro Max)
- The three skills installed. Impeccable ships its own binary.

| Skill | Install |
|---|---|
| Taste | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| UI UX Pro Max | `npm i -g uipro-cli && uipro init --ai claude` |
| Impeccable | `npx impeccable install` |

Claude Code plugin commands for each are in [`references/handoffs.md`](references/handoffs.md). A missing skill is reported and skipped; its output is never faked.

## Usage

Put this folder where your agent loads skills, then invoke it:

```
/meticulous [audit|fix|restyle|redesign|verify|gate] [target path, route or URL]
```

| Invocation | Runs |
|---|---|
| `audit [target]` (default) | Phases 0–4, stops at the option gate |
| `fix`, `restyle`, `redesign [target]` | Baseline, then fix, then the gate loop. `redesign` states its cost and waits for a yes |
| `verify` / `gate [target]` | Phase 6 against the existing baseline |

Plain language works too: "make the dashboard less generic."

## Repository layout

```
SKILL.md            Skill definition and phase instructions
scripts/
  preflight.mjs     Phase 0: environment and skill detection
  triage.mjs        Phase 2 and 6: merged, ranked findings
  gate.mjs          Phase 6: verdict, escalation, iteration log
references/
  handoffs.md       Install commands, ownership table, handoff packets
  surfaces.md       Per-surface guidance (landing, app, docs, portfolio)
  conflicts.md      Who wins when two players disagree
  report.md         Templates for audit.md and the result block
```

## Notes

- Native mobile has no detector and no Taste; Impeccable leads design there.
- Visual decisions go to Taste, interaction and accessibility to UI UX Pro Max, defect evidence to Impeccable. Pinned values in `PRODUCT.md` / `DESIGN.md` beat all three.
- All run state lives in `.meticulous/`. Add it to `.gitignore` if you don't want it committed.

