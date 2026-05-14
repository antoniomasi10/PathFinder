#!/usr/bin/env node
/**
 * Codemod: convert hardcoded px values to rem (1rem = 16px) for responsive scaling.
 *
 * Targets in .tsx / .ts files under frontend/:
 *   1. Tailwind bracket utilities: text-[16px], w-[363px], h-[24px], p-[8px], m-[12px],
 *      gap-[10px], px-[16px], py-[8px], pl/pr/pt/pb-[Npx], mx/my/ml/mr/mt/mb-[Npx],
 *      top/right/bottom/left-[Npx], rounded-[Npx], leading-[Npx], tracking-[Npx],
 *      max-w-[Npx], min-w-[Npx], max-h-[Npx], min-h-[Npx], inset-[Npx]
 *   2. Inline style numeric props: width: 188, height: 113, fontSize: 16, padding: 12,
 *      margin, top, left, right, bottom, gap, lineHeight, borderRadius — when the value
 *      is a bare number ≥ 2 (we keep 1px hairlines, 0, and < 2 untouched).
 *   3. Inline style string px: fontSize: '13.5px' → fontSize: '0.84375rem'
 *
 * Exclusions:
 *   - Values exactly 1 (would be a hairline border).
 *   - Values inside vh/vw/% — already fluid.
 *   - CSS animations / keyframes (we skip globals.css).
 *   - SVG width/height attributes (left as-is — codemod doesn't touch SVG attrs).
 *
 * Usage:
 *   node scripts/px-to-rem.mjs --dry      # preview changes
 *   node scripts/px-to-rem.mjs --apply    # write changes
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'frontend');
const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git']);
const SKIP_FILES = new Set(['globals.css']);

const EXTS = ['.tsx', '.ts', '.jsx', '.js'];

// Tailwind prefixes that take a length (we'll match prefix-[Npx])
const TW_LENGTH_PREFIXES = [
  'text', 'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h',
  'p', 'px', 'py', 'pl', 'pr', 'pt', 'pb',
  'm', 'mx', 'my', 'ml', 'mr', 'mt', 'mb',
  '-m', '-mx', '-my', '-ml', '-mr', '-mt', '-mb',
  'gap', 'gap-x', 'gap-y',
  'top', 'right', 'bottom', 'left', 'inset', 'inset-x', 'inset-y',
  'rounded', 'rounded-t', 'rounded-b', 'rounded-l', 'rounded-r',
  'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br',
  'leading', 'tracking',
  'translate-x', 'translate-y', '-translate-x', '-translate-y',
  'border', 'border-t', 'border-b', 'border-l', 'border-r',
  'space-x', 'space-y',
  'blur',
];

// Shorthand string props: 'N1px N2px [...]' — multi-value strings.
const SHORTHAND_STRING_PROPS = [
  'padding', 'margin', 'inset', 'borderRadius', 'border',
];

// Inline style numeric props that should be px-converted
const STYLE_NUM_PROPS = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'fontSize', 'lineHeight', 'letterSpacing',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'top', 'right', 'bottom', 'left',
  'gap', 'rowGap', 'columnGap',
  'borderRadius',
  // borderWidth intentionally excluded — keep crisp
]);

function pxToRemStr(px) {
  // Avoid floating point noise: keep up to 5 decimals, strip trailing zeros.
  const rem = px / 16;
  return rem.toFixed(5).replace(/\.?0+$/, '');
}

let totalFiles = 0;
let changedFiles = 0;
let totalReplacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && EXTS.includes(path.extname(entry.name))
             && !SKIP_FILES.has(entry.name)) {
      processFile(full);
    }
  }
}

function processFile(file) {
  totalFiles++;
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  let replacements = 0;

  // (1) Tailwind bracket utilities: matches optional responsive/state prefix.
  //     E.g. "sm:text-[16px]", "hover:w-[24px]", "p-[8.5px]", "-mt-[4px]"
  const twPattern = new RegExp(
    `(\\b(?:[a-z]+:)*-?(?:${TW_LENGTH_PREFIXES.map(p => p.replace(/-/g, '\\-')).join('|')}))-\\[(\\d+(?:\\.\\d+)?)px\\]`,
    'g'
  );
  out = out.replace(twPattern, (m, prefix, num) => {
    const px = parseFloat(num);
    if (px === 1) return m; // keep 1px hairlines
    replacements++;
    return `${prefix}-[${pxToRemStr(px)}rem]`;
  });

  // (2) Inline style numeric props inside style={{ ... }} blocks.
  //     We only touch lines that match `prop: N` or `prop: 'Npx'` patterns
  //     where prop ∈ STYLE_NUM_PROPS.
  for (const prop of STYLE_NUM_PROPS) {
    // bare number: width: 188,  height: 64 }
    const numRe = new RegExp(`(\\b${prop}\\s*:\\s*)(\\d+(?:\\.\\d+)?)(\\s*[,}])`, 'g');
    out = out.replace(numRe, (m, lead, num, tail) => {
      const px = parseFloat(num);
      if (px === 0 || px === 1) return m;
      // line-height in CSS is commonly a unitless ratio (1.0–3.0).
      // Don't convert small unitless values — they're ratios, not pixels.
      if (prop === 'lineHeight' && px < 4) return m;
      replacements++;
      return `${lead}'${pxToRemStr(px)}rem'${tail}`;
    });
    // quoted px string: fontSize: '13.5px'
    const strRe = new RegExp(`(\\b${prop}\\s*:\\s*)(['"\`])(\\d+(?:\\.\\d+)?)px\\2`, 'g');
    out = out.replace(strRe, (m, lead, quote, num) => {
      const px = parseFloat(num);
      if (px === 1) return m;
      replacements++;
      return `${lead}${quote}${pxToRemStr(px)}rem${quote}`;
    });
  }

  // (3) Shorthand strings with multiple px tokens:
  //     padding: '12px 16px', margin: '16px 24px 0',
  //     padding: '8px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)'.
  //     Replace each Npx token inside the string body; leave calc()/env()/keywords intact.
  for (const prop of SHORTHAND_STRING_PROPS) {
    const re = new RegExp(
      `(\\b${prop}\\s*:\\s*)(['"\`])([^'"\`]*?\\d+(?:\\.\\d+)?px[^'"\`]*?)\\2`,
      'g'
    );
    out = out.replace(re, (m, lead, q, body) => {
      const newBody = body.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => {
        const px = parseFloat(n);
        if (px === 1) return `${n}px`; // hairline preserved
        return `${pxToRemStr(px)}rem`;
      });
      if (newBody === body) return m;
      replacements++;
      return `${lead}${q}${newBody}${q}`;
    });
  }

  if (replacements > 0) {
    changedFiles++;
    totalReplacements += replacements;
    const rel = path.relative(process.cwd(), file);
    console.log(`${DRY ? '[dry]' : '[apply]'} ${rel} — ${replacements} replacement(s)`);
    if (APPLY) fs.writeFileSync(file, out, 'utf8');
  }
}

walk(ROOT);

console.log(`\nScanned ${totalFiles} files, ${changedFiles} would change, ${totalReplacements} total replacements.`);
console.log(DRY ? 'Dry run — re-run with --apply to write changes.' : 'Done.');
