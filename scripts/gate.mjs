#!/usr/bin/env node
// meticulous gate: the human decision gate for verification, plus the loop-back brief.
//
// Why a script: a loop that lives only in the model's memory drifts. Each iteration re-audits
// everything, forgets what was already tried, and repeats the same failed fix. This script keeps
// the loop's state on disk (.meticulous/loop.json), decides deterministically what failed,
// routes every failure to the player that owns it, and escalates to the backup player when the
// owner already tried and the failure persisted.
//
// Usage (from project root):
//   node <meticulous>/scripts/gate.mjs check [--inspect <report.json>] [--strict]
//        Compute the automated verdict for this iteration and print the gate card.
//        --strict (restyle/redesign runs): open P2 slop also blocks.
//   node <meticulous>/scripts/gate.mjs record <approve|ship-anyway|loop|redesign|stop>
//        [--note "<the human's words>"] [--areas hero,palette,section:pricing,...]
//        Record the human decision. loop/redesign writes .meticulous/next.json (the
//        loop-back brief) and prints the plan for the next iteration.
//   node <meticulous>/scripts/gate.mjs status
//        One line per iteration.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve('.meticulous');
const P = (f) => join(dir, f);
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const args = process.argv.slice(2);
const take = (name) => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const cmd = args.shift();

// loop.json: { iterations: [{ n, at, verdict, failures:[{rule, kind, owner, tier}], decision, note, areas }] }
const loop = read(P('loop.json')) || { iterations: [] };
const save = () => writeFileSync(P('loop.json'), JSON.stringify(loop, null, 1));
const current = () => loop.iterations[loop.iterations.length - 1];

// ---------- Ownership: who fixes what, and who takes over when that fails ----------
// Roles: Taste = lead designer; UUPM = UI/UX (interaction, a11y how-to, patterns, stack);
// Impeccable = auditor + backup designer for anti-AI-slop.
// tier 0 = primary owner, tier 1 = backup, tier 2 = stuck (needs a human call).
const KINDS = {
  a11y:   { re: /contrast|gray-on|touch|target|focus|alt|heading|label|aria|reduced-motion|zoom|keyboard/i, chain: ['uupm', 'impeccable'] },
  ux:     { re: /form|nav|error|empty|overflow|scroll|breakpoint|responsive|gesture|link|button|state/i, chain: ['uupm', 'impeccable'] },
  perf:   { re: /perf|layout-thrash|cls|bundle|lazy|will-change|animation-layout/i, chain: ['uupm', 'impeccable'] },
  slop:   { re: /gradient|eyebrow|shadow|glass|mono|font|side-tab|badge|pill|card|emoji|blob|glow|accent-word|index-number|hairline|outlined|bounce|em-dash|copy|framework-colour|placeholder/i, chain: ['taste', 'impeccable'] },
  visual: { re: /.*/, chain: ['taste', 'impeccable'] }, // frame, type scale, headline lines, motion, scenes: Taste's measures
};
const classify = (rule) => Object.entries(KINDS).find(([, k]) => k.re.test(rule))[0];

// How each player is asked to act on a failure kind. The model expands these into skill calls.
const ACTION = {
  taste:      { slop: 're-apply house rules to the files; if the tell is structural, --redraw the slot that produced it', visual: 'fix against the dealt sheet (draw.mjs --show); --redraw the slot only if the sheet itself caused it' },
  uupm:       { a11y: 'search.py "<outcome>" --domain ux -n 2, then --stack <stack>; implement the matched guideline', ux: 'search.py "<outcome>" --domain ux -n 2, then --stack <stack>', perf: 'search.py "<outcome>" --domain react -n 2 (or --stack <stack>)' },
  impeccable: { a11y: '/impeccable colorize (contrast) | adapt (touch/viewport) | polish (focus/states)', ux: '/impeccable harden | adapt | clarify', perf: '/impeccable optimize', slop: '/impeccable quieter | distill | typeset (anti-slop backup)', visual: '/impeccable layout | typeset' },
};

// Human-named areas map onto Taste's redraw slots; anything else is passed through as a note.
const SLOTS = new Set(['hero', 'type', 'palette', 'photos', 'scenes', 'direction']);
const areaToWork = (a) => (SLOTS.has(a) || a.startsWith('section:'))
  ? { owner: 'taste', action: `draw.mjs <same args> --redraw ${a}  (reason: human gate rejection; record it)` }
  : a === 'generic' || a === 'slop'
    ? { owner: 'taste', action: 'redraw the weakest slot named in the last critique, then Impeccable anti-slop pass (quieter/distill)', backup: 'impeccable' }
    : a === 'ux' || a === 'flow'
      ? { owner: 'uupm', action: 'search.py "<the flow>" --domain ux -n 2; fix the flow, then re-critique it' }
      : { owner: 'taste', action: `address "${a}" against the dealt sheet` };

// ---------- check ----------
if (cmd === 'check') {
  const triage = read(P('triage.json'));
  const base = read(P('triage.baseline.json'));
  if (!triage || !base) { console.error('Need triage.json and triage.baseline.json. Run triage.mjs (with --baseline once).'); process.exit(1); }
  const inspectPath = take('--inspect') || P('after/report.json');
  const inspect = read(inspectPath);
  // --strict: restyle/redesign runs exist to remove slop, so open P2 rules block there too.
  const strict = args.includes('--strict');

  // Automated criteria (all must hold for PASS): no regressions vs the original baseline,
  // zero P1, zero Taste FAIL where Taste could run. WARNs are listed for the human, not blocking.
  const failures = [];
  const added = Object.keys(triage.rules).filter((r) => !(r in base.rules));
  for (const r of added) failures.push({ rule: r, why: 'regression (new since baseline)', src: 'triage', files: triage.rules[r].hits.slice(0, 3).map((h) => h.file) });
  for (const [r, v] of Object.entries(triage.rules)) if ((v.sev === 1 || (strict && v.sev === 2)) && !added.includes(r)) failures.push({ rule: r, why: `P${v.sev} still open`, src: 'triage', files: v.hits.slice(0, 3).map((h) => h.file) });
  const warns = [];
  if (inspect) for (const f of inspect.findings || []) {
    if (f.level === 'FAIL') failures.push({ rule: f.id, why: `inspect FAIL @${f.width}`, src: 'inspect', files: [] });
    else if (f.level === 'WARN') warns.push(`${f.id}@${f.width}`);
  }

  // Escalation: if this rule failed in the previous iteration too, its owner already had a try.
  const prev = loop.iterations.length ? current() : null;
  const prevTier = Object.fromEntries((prev?.failures || []).map((f) => [f.rule, f.tier]));
  for (const f of failures) {
    f.kind = classify(f.rule);
    f.tier = f.rule in prevTier ? Math.min(prevTier[f.rule] + 1, 2) : 0;
    f.owner = f.tier === 2 ? 'human' : KINDS[f.kind].chain[f.tier];
  }

  const verdict = failures.length ? 'FAIL' : 'PASS';
  const n = loop.iterations.length + 1;
  loop.iterations.push({ n, at: new Date().toISOString(), verdict, counts: triage.counts, failures, warns, inspected: !!inspect, decision: null });
  save();

  // Gate card: everything the human needs to decide, nothing else.
  console.log(`GATE  iteration ${n}  automated verdict: ${verdict}${strict ? '  [strict: P2 blocks]' : ''}`);
  console.log(`      P1 ${base.counts.P1}->${triage.counts.P1}  P2 ${base.counts.P2}->${triage.counts.P2}  P3 ${base.counts.P3}->${triage.counts.P3}` +
    `  resolved ${Object.keys(base.rules).filter((r) => !(r in triage.rules)).length}  regressions ${added.length}`);
  console.log(`      taste inspect: ${inspect ? `${(inspect.findings || []).filter((f) => f.level === 'FAIL').length} FAIL, ${warns.length} WARN` : 'not run (no browser or no URL) - human eyes are the visual check'}`);
  for (const f of failures) console.log(`  x ${f.rule.padEnd(22)} ${f.why.padEnd(28)} -> ${f.owner}${f.tier ? (f.tier === 2 ? ' (STUCK: owner and backup both tried)' : ' (escalated to backup)') : ''}`);
  if (warns.length) console.log(`  ~ warns: ${warns.slice(0, 8).join(', ')}${warns.length > 8 ? ' ...' : ''}`);
  console.log(`RECOMMEND ${verdict === 'PASS' ? 'approve' : failures.some((f) => f.owner === 'human') ? 'decide stuck items (ship-anyway with exceptions, or redesign the area)' : 'loop'}`);
  console.log('ASK THE HUMAN: approve | ship-anyway | loop | redesign (name areas) | stop');
  process.exit(0);
}

// ---------- record ----------
if (cmd === 'record') {
  const decision = args.shift();
  const valid = ['approve', 'ship-anyway', 'loop', 'redesign', 'stop'];
  if (!valid.includes(decision)) { console.error(`decision must be one of: ${valid.join(', ')}`); process.exit(1); }
  const it = current();
  if (!it || it.decision) { console.error('No open gate. Run "gate.mjs check" first.'); process.exit(1); }
  const note = take('--note') || '';
  const areas = (take('--areas') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (decision === 'approve' && it.verdict === 'FAIL') { console.error('Automated verdict is FAIL. Use "ship-anyway" so the open failures are recorded as accepted exceptions.'); process.exit(1); }
  Object.assign(it, { decision, note, areas, decidedAt: new Date().toISOString() });
  save();

  if (decision === 'approve' || decision === 'ship-anyway' || decision === 'stop') {
    const open = decision === 'approve' ? [] : it.failures.map((f) => f.rule);
    console.log(`CLOSED  iteration ${it.n}: ${decision}${open.length ? `  open/accepted: ${open.join(', ')}` : ''}`);
    console.log(decision === 'stop' ? 'NEXT  report state and stop; no Phase 7 edits.' : `NEXT  Phase 7 (record). ${open.length ? 'Record each accepted failure as an exception (Impeccable ignores + Taste --allow) in audit.md.' : ''}`);
    process.exit(0);
  }

  // loop / redesign: build the loop-back brief. Scope = what failed + what the human named.
  const packets = {};
  const add = (owner, item) => (packets[owner] ||= []).push(item);
  for (const f of it.failures) {
    if (f.owner === 'human') continue; // stuck items only re-enter if the human named their area
    add(f.owner, { rule: f.rule, why: f.why, files: f.files, action: ACTION[f.owner][f.kind] || ACTION[f.owner].visual });
  }
  for (const a of areas) { const w = areaToWork(a); add(w.owner, { area: a, action: w.action }); if (w.backup) add(w.backup, { area: a, action: 'anti-slop pass after Taste: /impeccable quieter | distill' }); }

  const files = [...new Set(it.failures.flatMap((f) => f.files))];
  // Re-audit depth: a human "redesign" or a visual complaint needs fresh critique; a pure defect
  // loop only needs the scoped technical audit. This is what keeps the loop cheap.
  const recritique = decision === 'redesign' || areas.length > 0 || /look|feel|generic|ugly|bland|ai|slop|boring/i.test(note);
  const next = {
    iteration: it.n + 1, from: decision, humanNote: note, areas,
    reaudit: { triage: 'triage.mjs <same targets> (no --baseline: delta stays against the original)', audit: files.length ? `/impeccable audit ${files.join(' ')}` : 'skip (no file-level failures)', critique: recritique ? '/impeccable critique <target> (target + mode only; never the triage table)' : 'skip' },
    work: packets,
    order: ['taste', 'uupm', 'impeccable'].filter((o) => packets[o]), // lead design first, UX second, anti-slop backup last
    stuck: it.failures.filter((f) => f.owner === 'human').map((f) => f.rule),
  };
  writeFileSync(P('next.json'), JSON.stringify(next, null, 1));
  console.log(`LOOP  -> iteration ${next.iteration} (${decision})${note ? `  human: "${note}"` : ''}`);
  console.log(`  re-audit: triage | audit ${files.length ? 'scoped to ' + files.length + ' file(s)' : 'skipped'} | critique ${recritique ? 'yes' : 'skipped'}`);
  for (const o of next.order) for (const w of packets[o]) console.log(`  ${o.padEnd(10)} ${(w.rule || 'area:' + w.area).padEnd(22)} ${w.action}`);
  if (next.stuck.length) console.log(`  not looped (stuck, needs a human area or exception): ${next.stuck.join(', ')}`);
  console.log('brief .meticulous/next.json');
  process.exit(0);
}

// ---------- status ----------
if (cmd === 'status') {
  if (!loop.iterations.length) { console.log('No gate iterations yet.'); process.exit(0); }
  for (const it of loop.iterations) console.log(`#${it.n} ${it.verdict} P1=${it.counts.P1} P2=${it.counts.P2} fails=${it.failures.length} -> ${it.decision || 'AWAITING HUMAN'}${it.note ? ` "${it.note}"` : ''}`);
  process.exit(0);
}

console.error('usage: gate.mjs check [--inspect <report.json>] | record <approve|ship-anyway|loop|redesign|stop> [--note ".."] [--areas a,b] | status');
process.exit(1);
