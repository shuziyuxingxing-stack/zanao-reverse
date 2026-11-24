// Execute the obfuscator's own header (string array + accessor + rotation IIFE),
// then resolve every NAME(0xNNN) call in the rest of the bundle.
const fs = require('fs');
const path = require('path');

function matchBrace(src, i) {
  let depth = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; k++;
      while (k < src.length) {
        if (src[k] === '\\') { k += 2; continue; }
        if (src[k] === q) break;
        k++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return k + 1; }
  }
  return src.length;
}

function takeFuncs(src, pos) {
  let code = '', i = pos;
  for (;;) {
    const rest = src.slice(i, i + 400);
    const m = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(rest);
    if (!m) break;
    const b = src.indexOf('{', i + m[0].length - 1);
    if (b < 0) break;
    const e = matchBrace(src, b);
    code += src.slice(i, e) + '\n';
    i = e;
  }
  return { code, end: i };
}

function build(src) {
  const m = /\}\(\s*([A-Za-z_$][\w$]*)\s*,\s*(0x[0-9a-fA-F]+)\s*\)/.exec(src);
  if (!m) return null;
  const iifeEnd = m.index + m[0].length;
  const extra = takeFuncs(src, iifeEnd);
  const head = src.slice(0, iifeEnd);

  let api = null, err = null, used = null;
  for (const suffix of [');', ')', '));', '),0);', ';']) {
    const header = head + suffix + '\n' + extra.code;
    const names = [...header.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]);
    const ret = names.map(n => `${JSON.stringify(n)}: (typeof ${n} === 'function' ? ${n} : null)`).join(',');
    try {
      api = new Function(header + '\nreturn {' + ret + '};')();
      used = suffix;
      break;
    } catch (e) { err = String(e); api = null; }
  }
  if (!api) return { error: err };
  return { api, end: extra.end, arrName: m[1], suffix: used };
}

function resolve(src, api, end) {
  const re = /\b([A-Za-z_$][\w$]*)\s*\(\s*(0x[0-9a-fA-F]+)\s*\)/g;
  let out = '', last = end, m;
  while ((m = re.exec(src))) {
    if (m.index < end) continue;
    const fn = api[m[1]];
    if (typeof fn !== 'function') continue;
    let v;
    try { v = fn(parseInt(m[2], 16)); } catch (e) { continue; }
    if (typeof v !== 'string') continue;
    out += src.slice(last, m.index) + "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    last = re.lastIndex;
  }
  return out + src.slice(last);
}

for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8');
  const b = build(src);
  if (!b) { console.error(`${path.basename(f)}: no header`); continue; }
  if (b.error) { console.error(`${path.basename(f)}: ${b.error}`); continue; }
  const arr = b.api[b.arrName] ? b.api[b.arrName]() : null;
  fs.writeFileSync(f + '.dec.js', resolve(src, b.api, b.end));
  if (Array.isArray(arr)) fs.writeFileSync(f + '.strtab.json', JSON.stringify(arr));
  console.error(`${path.basename(f)}: strings=${Array.isArray(arr) ? arr.length : 'n/a'} suffix=${JSON.stringify(b.suffix)}`);
}
