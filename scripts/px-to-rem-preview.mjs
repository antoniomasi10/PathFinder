#!/usr/bin/env node
// Preview transformed output for a single file (diff-style)
import fs from 'node:fs';

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
];
const STYLE_NUM_PROPS = new Set([
  'width','height','minWidth','maxWidth','minHeight','maxHeight',
  'fontSize','lineHeight','letterSpacing',
  'padding','paddingTop','paddingBottom','paddingLeft','paddingRight',
  'margin','marginTop','marginBottom','marginLeft','marginRight',
  'top','right','bottom','left','gap','rowGap','columnGap','borderRadius',
]);

function pxToRemStr(px){const r=px/16;return r.toFixed(5).replace(/\.?0+$/,'');}

const file = process.argv[2];
if (!file) { console.error('usage: node px-to-rem-preview.mjs <file>'); process.exit(1); }
const src = fs.readFileSync(file, 'utf8');
let out = src;

const twPattern = new RegExp(
  `(\\b(?:[a-z]+:)*-?(?:${TW_LENGTH_PREFIXES.map(p=>p.replace(/-/g,'\\-')).join('|')}))-\\[(\\d+(?:\\.\\d+)?)px\\]`,
  'g'
);
out = out.replace(twPattern,(m,prefix,num)=>{const px=parseFloat(num);return px===1?m:`${prefix}-[${pxToRemStr(px)}rem]`;});
for (const prop of STYLE_NUM_PROPS) {
  const numRe = new RegExp(`(\\b${prop}\\s*:\\s*)(\\d+(?:\\.\\d+)?)(\\s*[,}])`,'g');
  out = out.replace(numRe,(m,lead,num,tail)=>{const px=parseFloat(num);return (px===0||px===1)?m:`${lead}'${pxToRemStr(px)}rem'${tail}`;});
  const strRe = new RegExp(`(\\b${prop}\\s*:\\s*)(['"\`])(\\d+(?:\\.\\d+)?)px\\2`,'g');
  out = out.replace(strRe,(m,lead,q,num)=>{const px=parseFloat(num);return px===1?m:`${lead}${q}${pxToRemStr(px)}rem${q}`;});
}

// Print diff: only lines that changed
const a = src.split('\n'), b = out.split('\n');
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    console.log(`L${i+1}:`);
    console.log(`  - ${a[i]}`);
    console.log(`  + ${b[i]}`);
  }
}
