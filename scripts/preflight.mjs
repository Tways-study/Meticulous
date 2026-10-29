#!/usr/bin/env node
// meticulous preflight
// Finds the three sub-skills, checks runtimes, detects the project's stack and surface,
// and writes everything to .meticulous/env.json so later phases read one small file
// instead of re-probing the machine. Prints a ~10-line summary (token-cheap by design).
//
// Usage: node <meticulous>/scripts/preflight.mjs [project-root]
// Needs Node 18+. Never installs anything.

import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = resolve(process.argv[2] || process.cwd());
const home = homedir();
const isWin = platform() === 'win32';

// ---------- 1. Locate sub-skills ----------
// Skills can live project-local, user-global, or inside a plugin cache. We search those roots
// a few levels deep and identify each skill by a file only it ships, not by folder name
// (plugin installs namespace folders unpredictably).
const searchRoots = [
  join(root, '.claude', 'skills'),
  join(root, '.agents', 'skills'),
  join(home, '.claude', 'skills'),
  join(home, '.claude', 'plugins'),
  join(home, '.agents', 'skills'),
].filter((p) => existsSync(p));

const signatures = {
  impeccable: (d) => existsSync(join(d, 'scripts', 'impeccable')) && existsSync(join(d, 'SKILL.md')),
  taste: (d) => existsSync(join(d, 'scripts', 'draw.mjs')) && existsSync(join(d, 'scripts', 'inspect.mjs')),
  uupm: (d) => existsSync(join(d, 'scripts', 'search.py')) && existsSync(join(d, 'scripts', 'design_system.py')),
};

function walk(dir, depth, hits) {
  if (depth < 0) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const [name, test] of Object.entries(signatures)) {
    if (!hits[name] && test(dir)) hits[name] = dir; // first hit wins: project-local beats global (search order)
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    // Follow symlinks: Taste's install.sh and `impeccable link` install skills as symlinks,
    // and Dirent.isDirectory() is false for a link. Depth limit prevents link cycles.
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) { try { isDir = statSync(join(dir, e.name)).isDirectory(); } catch { isDir = false; } }
    if (isDir) walk(join(dir, e.name), depth - 1, hits);
  }
}
const skills = {};
for (const r of searchRoots) walk(r, 6, skills);

// ---------- 2. Runtimes ----------
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim(); } catch { return null; } };
const nodeMajor = Number(process.versions.node.split('.')[0]);
const python = ['python3', 'python', 'py'].find((c) => run(c, ['--version'])) || null;

// Taste's inspect.mjs needs a Chromium-family browser; we only report presence, Taste finds it itself.
const chromeCandidates = isWin
  ? [`${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`]
  : ['/Applications/Google Chrome.app', '/Applications/Microsoft Edge.app', '/Applications/Chromium.app'];
const chromeOnPath = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].some((c) => run(c, ['--version']));
const chrome = chromeOnPath || chromeCandidates.some((p) => p && existsSync(p));

// ---------- 3. Project stack + surface ----------
let pkg = {};
try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); } catch { /* not a JS project */ }
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const has = (d) => d in deps;

// UUPM --stack values; order matters (most specific first).
const stack =
  has('expo') || has('react-native') ? 'react-native'
  : has('next') ? 'nextjs'
  : has('nuxt') ? 'nuxtjs'
  : has('astro') ? 'astro'
  : has('svelte') || has('@sveltejs/kit') ? 'svelte'
  : has('vue') ? 'vue'
  : has('@angular/core') ? 'angular'
  : has('react') ? 'react'
  : existsSync(join(root, 'pubspec.yaml')) ? 'flutter'
  : 'html-tailwind';
const shadcn = existsSync(join(root, 'components.json'));
const tailwind = has('tailwindcss');

// Platform decides which toolchain is even valid (detector + Taste are web-only).
const platformKind =
  stack === 'react-native' ? (has('react-native-web') ? 'mobile+web' : 'mobile')
  : has('@tauri-apps/api') || existsSync(join(root, 'src-tauri')) ? 'desktop-tauri'
  : has('electron') ? 'desktop-electron'
  : 'web';

// Where UI source lives: scope the free scan here so it doesn't crawl the whole repo.
const srcDirs = ['src', 'app', 'pages', 'components', 'public'].filter((d) => existsSync(join(root, d)));
const devScript = pkg.scripts && (pkg.scripts.dev ? 'dev' : pkg.scripts.start ? 'start' : null);

// Impeccable + UUPM durable context already present?
const context = {
  productMd: existsSync(join(root, 'PRODUCT.md')),
  designMd: existsSync(join(root, 'DESIGN.md')),
  uupmMaster: (() => { try { return readdirSync(join(root, 'design-system')).some((d) => existsSync(join(root, 'design-system', d, 'MASTER.md'))); } catch { return false; } })(),
  critiques: (() => { try { return readdirSync(join(root, '.impeccable', 'critique')).length; } catch { return 0; } })(),
};

// ---------- 4. Capability flags (what Meticulous may route to) ----------
const web = platformKind !== 'mobile';
const caps = {
  detector: !!skills.impeccable && web,                        // free deterministic scan
  tasteLint: !!skills.taste && nodeMajor >= 18 && web,         // free source scan
  tasteInspect: !!skills.taste && nodeMajor >= 22 && chrome && web, // browser gate
  uupm: !!skills.uupm && !!python,
};

const env = { root, generatedAt: new Date().toISOString(), skills, runtimes: { node: process.versions.node, python, chrome }, project: { stack, shadcn, tailwind, platform: platformKind, srcDirs, devScript }, context, caps };
const outDir = join(root, '.meticulous');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'env.json'), JSON.stringify(env, null, 1));
// Keep Meticulous state out of git by default; the user can commit audit.md if they want it.
if (!existsSync(join(outDir, '.gitignore'))) writeFileSync(join(outDir, '.gitignore'), '*\n!.gitignore\n!audit.md\n');

// ---------- 5. Compact summary ----------
const yn = (b) => (b ? 'yes' : 'NO');
const missing = Object.keys(signatures).filter((k) => !skills[k]);
console.log(`skills    impeccable=${yn(skills.impeccable)} taste=${yn(skills.taste)} uupm=${yn(skills.uupm)}`);
console.log(`runtimes  node=${process.versions.node} python=${python || 'NO'} chrome=${yn(chrome)}`);
console.log(`project   stack=${stack}${shadcn ? '+shadcn' : ''}${tailwind ? '+tailwind' : ''} platform=${platformKind} src=[${srcDirs.join(',') || '.'}] dev=${devScript || 'none'}`);
console.log(`context   PRODUCT.md=${yn(context.productMd)} DESIGN.md=${yn(context.designMd)} uupm-master=${yn(context.uupmMaster)} critiques=${context.critiques}`);
console.log(`caps      detector=${yn(caps.detector)} tasteLint=${yn(caps.tasteLint)} tasteInspect=${yn(caps.tasteInspect)} uupm=${yn(caps.uupm)}`);
if (missing.length) console.log(`MISSING   ${missing.join(', ')} -> see references/handoffs.md "Install"`);
console.log(`env       .meticulous/env.json`);
