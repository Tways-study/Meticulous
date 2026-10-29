# Conflicts

Authority is split by **domain**, so a disagreement is settled by asking what kind of decision it is.

| Domain | Authority | Overridden only by |
|---|---|---|
| Product facts, audience, claims, content | PRODUCT.md (Impeccable's record) | The human |
| Pinned brand values (logo, brand colours, brand fonts) | DESIGN.md | The human |
| Visual design: composition, type, palette, imagery, motion, frame | **Taste** (lead designer) | Pinned brand values; accessibility |
| Interaction and accessibility: states, focus, forms, navigation, touch, contrast how-to | **UUPM** (UI/UX) | The human; WCAG AA is a floor nobody overrides |
| Whether something is a defect or AI slop | **Impeccable** (auditor) evidence + Taste lint | A human exception at the gate |

Accessibility (WCAG AA) beats every aesthetic rule. The human's decision at a gate beats everything and is recorded.

## Known collisions and rulings

| Collision | Ruling | Record |
|---|---|---|
| UUPM `--design-system` returns a framework default colour (`#2563EB`, `#3B82F6`, `#10B981`…) or a monospace display face | Rejected: visual domain belongs to Taste; both scanners flag these. Keep UUPM's pattern, effects, anti-patterns and checklist only. Never `--persist` its MASTER.md | — |
| Taste's dealt palette fails contrast for some text/fill pair | UUPM's contrast guideline wins for that pair; keep Taste's proportions and hue, adjust lightness. Never swap the palette for a UUPM one | §Decisions |
| UUPM recommends a pattern Taste bans (icon feature cards, pill badges, cards-in-grid, glass) | Taste wins on visuals; satisfy UUPM's *underlying* UX need (scannability, grouping, affordance) another way | — |
| Taste's composition hides a needed affordance (no visible button, hover-only control, tiny tap target) | UUPM wins on interaction; keep the composition, fix the affordance inside it | — |
| DESIGN.md pins a font/colour Taste or the detector flags | Keep the brand. Taste `--keep palette,type` and `inspect --allow <rule>`; `impeccable ignores add-value <rule> <value> --reason "brand"` | §Exceptions |
| Brand asset contains a banned device (gradient logo) | Keep the asset; ban the device everywhere else | §Exceptions |
| Impeccable's redesign flow wants its own visual world (new-work) on web | Taste deals; Impeccable records it afterwards via `/impeccable document` | §Decisions |
| Impeccable (backup) and Taste disagree on a fix after escalation | Taste's direction stands; the backup fixes inside it. If impossible, the item goes stuck → human | §Trade-offs |
| A fix trades one finding for another | Re-triage; keep the fix if it removed a P1 and added at most a P2; note it | §Trade-offs |
| Automated gate PASS but the human says it looks wrong | Human wins: `record redesign --areas ...` | Iteration log |
| Automated gate FAIL but the human wants to ship | Human wins: `record ship-anyway`; every open failure becomes a recorded exception | §Exceptions |
