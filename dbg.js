const fs=require('fs');
const f=process.argv[2];
const src=fs.readFileSync(f,'utf8');
const m=/\}\(\s*([A-Za-z_$][\w$]*)\s*,\s*(0x[0-9a-fA-F]+)\s*\)/.exec(src);
console.log('match', m && m[1], m && m[2]);
const end=m.index+m[0].length;
console.log('TAIL', JSON.stringify(src.slice(Math.max(0,end-90), end+40)));
console.log('HEAD', JSON.stringify(src.slice(0,50)));
try { new Function(src.slice(0,end)+';'); console.log('header parses OK'); }
catch(e){ console.log('header parse error:', String(e)); }
