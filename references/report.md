# audit.md template

Write `.meticulous/audit.md` in this shape. Evidence over adjectives: every finding cites a rule id, a measurement, a file:line or a screenshot. Keep it under ~120 lines; link to `triage.json` and `.impeccable/critique/` for detail instead of copying them.

```markdown
# Design audit — <project> · <target> · <date>

**Surface:** <mode> · <platform> · <stack>
**Context:** PRODUCT.md <yes/no> · DESIGN.md <yes/no>
**Ran:** detector · taste-lint · impeccable audit · impeccable critique · taste inspect (<widths>) · uupm (<n> queries)
**Skipped:** <tool — reason>

## Scores
| Dimension | Score | Source |
|---|---|---|
| Accessibility | x/4 | impeccable audit |
| Performance | x/4 | impeccable audit |
| Theming | x/4 | impeccable audit |
| Responsive | x/4 | impeccable audit |
| Implementation integrity | x/4 | impeccable audit |
| Design (heuristic) | x/<scale> | impeccable critique |
| Frame / house style | <FAIL n · WARN n> | taste inspect |
| Deterministic | P1 n · P2 n · P3 n | triage |

## Verdict
<Two sentences: the single biggest problem and why it matters to this product's users.>

## Findings (P1 first, max 12; the rest live in triage.json)
| P | Finding | Evidence | Fix with |
|---|---|---|---|
| P1 | Body text fails contrast on cards | low-contrast 2.9:1, src/app/page.tsx:42 | `colorize` |

## Exceptions
<Brand-driven rule exceptions and where they were recorded (Impeccable ignores, Taste --allow).>

## Decisions · Trade-offs
<Direction dealt (id + seed), redraws and reasons; trade-offs accepted.>

## Options
| Option | Scope | Cost | Expected result |
|---|---|---|---|
| Fix | <n> findings across <files> | Low | P1 → 0 |
| Polish | Fix + critique backlog | Low–med | |
| Restyle | type/colour/components, layout kept | Medium | |
| Redesign | full direction + rebuild of <surface> | High (~30–45 min, few 100k tokens) | |

**Recommended:** <option> — <one-line reason from the evidence>.
```

At each verification gate, show the human (in chat, not only in the file) the `gate.mjs check` card, the before/after screenshots at 390 and 1440, and one recommendation line. After the gate closes, append:

```markdown
## Iterations
| # | Verdict | P1 | P2 | Failures (owner) | Human decision | Note |
|---|---|---|---|---|---|---|
| 1 | FAIL | 2 | 4 | low-contrast (uupm), shadow (taste) | loop: redesign hero | "hero feels generic" |
| 2 | PASS | 0 | 1 | — | approve | |
(from `gate.mjs status` and `.meticulous/loop.json`)

## Result
Delta: P1 a→b · P2 a→b · P3 a→b · resolved: <rules> · new: <rules or none>
Taste inspect: FAIL a→b · WARN a→b
Remaining: <what's left and why>
Replace before launch: <sample content, found images with credits>
```
