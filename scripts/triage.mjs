#!/usr/bin/env node
// meticulous triage: the zero-LLM-token first pass.
// Runs the two deterministic scanners the sub-skills ship
//   - Impeccable detector  (scripts/impeccable detect --json)  -> a11y/quality + slop rules
//   - Taste lint           (scripts/lint.mjs --json)           -> house-style bans in source
// then merges, de-duplicates and ranks them into ONE compact table. The raw scanner output
// (long descriptions repeated per hit) is the expensive part to read; this script reads it
// so the model doesn't, and writes the full detail to .meticulous/triage.json.
//
// Usage (from project root):
//   node <meticulous>/scripts/triage.mjs [paths... | url] [--app] [--baseline] [--max N]
//   node <meticulous>/scripts/triage.mjs --explain <rule>     # full text for one rule, on demand
//
// --baseline  save this run as the "before" snapshot (first audit); later runs print a delta.
// --app       app-screen rules for Taste lint (dashboards, admin, settings).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const args = process.argv.slice(2);
const take = (name) => { const i = args.indexOf(name); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (name) => { const i = args.indexOf(name); if (i === -1) return false; args.splice(i, 1); return true; };

const outDir = resolve('.meticulous');
const envPath = join(outDir, 'env.json');
if (!existsSync(envPath)) { console.error('No .meticulous/env.json. Run scripts/preflight.mjs first.'); process.exit(1); }
const env = JSON.parse(readFileSync(envPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

// ---------- --explain: lazy-load one rule's full text instead of every hit's ----------
const explain = take('--explain');
if (explain) {
  const t = existsSync(join(outDir, 'triage.json')) ? JSON.parse(readFileSync(join(outDir, 'triage.json'), 'utf8')) : null;
  const r = t && t.rules[explain];
  if (!r) { console.error(`No rule "${explain}" in the last triage.`); process.exit(1); }
  console.log(`${explain} [${r.sources.join('+')}] ${r.name || ''}\n${r.text}\nhits:`);
  for (const h of r.hits.slice(0, 15)) console.log(`  ${h.file}${h.line ? ':' + h.line : ''}  ${h.sample}`);
  process.exit(0);
}

const appMode = flag('--app');
const asBaseline = flag('--baseline');
const max = Number(take('--max') || 25);
const targets = args.length ? args : (env.project.srcDirs.length ? env.project.srcDirs : ['.']);
const urls = targets.filter((t) => /^https?:\/\//.test(t));
const paths = targets.filter((t) => !/^https?:\/\//.test(t));

const hits = []; // normalized: { src, rule, sev, file, line, sample, name, text }
const ran = [];
const skipped = [];

// ---------- Impeccable detector (source paths and/or URLs; web only) ----------
if (env.caps.detector) {
  const dir = env.skills.impeccable;
  const isWin = platform() === 'win32';
  const cmd = isWin ? join(dir, 'scripts', 'impeccable.cmd') : 'sh';
  const pre = isWin ? [] : [join(dir, 'scripts', 'impeccable')];
  const r = spawnSync(cmd, [...pre, 'detect', '--json', ...targets], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 180000, shell: isWin });
  // Exit 0 = clean, 2 = findings, 1 = a target could not be scanned (still parse what came back).
  let arr = [];
  try { arr = JSON.parse(r.stdout || '[]'); } catch { /* non-JSON = failure */ }
  if (r.status === 1 || r.error) skipped.push(`detector: ${(r.stderr || String(r.error || '')).split('\n').filter(Boolean).slice(-1)[0] || 'scan failed'}`);
  if (Array.isArray(arr)) {
    ran.push('detector');
    for (const f of arr) {
      hits.push({
        src: 'imp', rule: f.antipattern, name: f.name, text: f.description,
        // Impeccable: quality = real defects; slop = AI-pattern tells; advisory/info never fail a scan.
        sev: /advis|info/i.test(f.severity) ? 3 : /error|critical/i.test(f.severity) || f.category === 'quality' ? 1 : 2,
        file: rel(f.file), line: f.line || 0, sample: clip(f.snippet),
      });
    }
  }
} else skipped.push(env.skills.impeccable ? 'detector: native platform (web-only tool)' : 'detector: Impeccable not installed');

// ---------- Taste lint (source only; URLs aren't lintable) ----------
if (env.caps.tasteLint && paths.length) {
  const r = spawnSync(process.execPath, [join(env.skills.taste, 'scripts', 'lint.mjs'), ...paths, '--json', ...(appMode ? ['--app'] : [])], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120000 });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { /* exit 2 = no source files */ }
  if (out) {
    ran.push('taste-lint');
    for (const f of out.findings) {
      hits.push({ src: 'taste', rule: f.id, name: '', text: f.message, sev: f.level === 'FAIL' ? 2 : 3, file: f.file, line: f.line, sample: clip(f.match) });
    }
  } else skipped.push(`taste-lint: ${(r.stderr || '').trim().split('\n')[0] || 'no output'}`);
} else if (!env.caps.tasteLint) skipped.push(env.skills.taste ? 'taste-lint: native platform' : 'taste-lint: Taste not installed');

if (!ran.length) { console.log(`triage: no scanner ran.\n  ${skipped.join('\n  ')}`); process.exit(1); }

// ---------- Merge + rank ----------
// Both tools flag some of the same tells under the same or similar ids; one row per tell,
// and "confirmed by both" is a stronger signal than either alone.
const ALIAS = { 'gradient-text': 'gradient-text', 'side-tab': 'side-tab', eyebrow: 'eyebrow', 'overused-font': 'overused-font', font: 'overused-font', 'default-font': 'overused-font', shadow: 'shadow', mono: 'monospace', glass: 'glass' };
// Accessibility outranks taste: any a11y-shaped rule is P1 regardless of which tool raised it.
const A11Y = /contrast|touch|target|focus|alt|heading|label|aria|reduced-motion|zoom/i;

const rules = {};
for (const h of hits) {
  const key = ALIAS[h.rule] || h.rule;
  const r = (rules[key] ||= { sev: 9, sources: [], name: '', text: '', hits: [] });
  if (A11Y.test(key)) h.sev = 1;
  r.sev = Math.min(r.sev, h.sev);
  if (!r.sources.includes(h.src)) r.sources.push(h.src);
  r.name ||= h.name; r.text ||= h.text;
  r.hits.push({ file: h.file, line: h.line, sample: h.sample });
}
const rows = Object.entries(rules)
  .map(([rule, r]) => ({ rule, ...r, n: r.hits.length, both: r.sources.length > 1 }))
  .sort((a, b) => a.sev - b.sev || b.both - a.both || b.n - a.n);

// Hotspots: files with most findings -> the scope handed to Impeccable audit/critique.
const perFile = {};
for (const h of hits) if (h.file !== '(all files)') perFile[h.file] = (perFile[h.file] || 0) + 1;
const hotspots = Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 5);

const result = { at: new Date().toISOString(), targets, ran, skipped, counts: { P1: rows.filter((r) => r.sev === 1).length, P2: rows.filter((r) => r.sev === 2).length, P3: rows.filter((r) => r.sev === 3).length }, hotspots, rules: Object.fromEntries(rows.map((r) => [r.rule, { sev: r.sev, sources: r.sources, name: r.name, text: r.text, hits: r.hits }])) };
writeFileSync(join(outDir, 'triage.json'), JSON.stringify(result, null, 1));

// ---------- Delta vs baseline (verify phase) ----------
const basePath = join(outDir, 'triage.baseline.json');
let delta = '';
if (asBaseline) writeFileSync(basePath, JSON.stringify(result, null, 1));
else if (existsSync(basePath)) {
  const b = JSON.parse(readFileSync(basePath, 'utf8'));
  const before = new Set(Object.keys(b.rules)); const after = new Set(Object.keys(result.rules));
  const fixed = [...before].filter((k) => !after.has(k));
  const added = [...after].filter((k) => !before.has(k));
  delta = `delta   P1 ${b.counts.P1}->${result.counts.P1}  P2 ${b.counts.P2}->${result.counts.P2}  P3 ${b.counts.P3}->${result.counts.P3}` +
    (fixed.length ? `\n        resolved: ${fixed.join(', ')}` : '') +
    (added.length ? `\n        NEW (regressions): ${added.join(', ')}` : '');
}

// ---------- Compact table ----------
console.log(`triage  ran=${ran.join('+')} hits=${hits.length} rules=${rows.length} (P1 ${result.counts.P1} / P2 ${result.counts.P2} / P3 ${result.counts.P3})${asBaseline ? ' [saved as baseline]' : ''}`);
if (skipped.length) console.log(`skipped ${skipped.join(' | ')}`);
if (hotspots.length) console.log(`hot     ${hotspots.map(([f, n]) => `${f}(${n})`).join('  ')}`);
if (delta) console.log(delta);
console.log('P  rule                     n   by        first hit');
for (const r of rows.slice(0, max)) {
  const h = r.hits[0];
  console.log(`P${r.sev} ${pad(r.rule, 24)} ${pad(String(r.n), 3)} ${pad(r.sources.join('+'), 9)} ${h.file}${h.line ? ':' + h.line : ''}  ${h.sample}`);
}
if (rows.length > max) console.log(`... ${rows.length - max} more in .meticulous/triage.json`);
console.log('detail  node <meticulous>/scripts/triage.mjs --explain <rule>');

function rel(p) { const cwd = process.cwd().split('\\').join('/') + '/'; return String(p || '').split('\\').join('/').replace(cwd, ''); }
function clip(s) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > 60 ? s.slice(0, 57) + '...' : s; }
function pad(s, n) { return s.length >= n ? s : s + ' '.repeat(n - s.length); }
