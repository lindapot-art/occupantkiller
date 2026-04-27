// Scan weapons.js for detached weapon parts (mesh vars declared but never .add()ed).
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'weapons.js', 'utf8');
const lines = src.split('\n');

const fnRe = /^\s*function (build\w+Mesh)\s*\(/;
let curr = null, start = 0, depth = 0;
const fns = [];
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (!curr) {
    const m = L.match(fnRe);
    if (m) { curr = m[1]; start = i; depth = 0; }
  }
  if (curr) {
    for (const c of L) { if (c === '{') depth++; else if (c === '}') depth--; }
    if (depth === 0 && i > start && L.includes('}')) {
      fns.push({ name: curr, body: lines.slice(start, i + 1).join('\n'), startLine: start + 1 });
      curr = null;
    }
  }
}

const report = [];
for (const f of fns) {
  const declRe = /(?:const|var|let)\s+(\w+)\s*=\s*(?:new\s+THREE\.(?:Mesh|Group)|\w+\.clone\s*\()/g;
  const decls = new Set();
  let m;
  while ((m = declRe.exec(f.body))) decls.add(m[1]);
  const orphans = [];
  for (const v of decls) {
    // Match either: someParent.add( ... v ... )  OR  v.add(  (it's a parent itself)
    const addAsChild = new RegExp('\\b\\w+\\.add\\s*\\([^)]*\\b' + v + '\\b');
    const addAsParent = new RegExp('\\b' + v + '\\.add\\s*\\(');
    const isReturned = new RegExp('return\\s+' + v + '\\b');
    if (!addAsChild.test(f.body) && !addAsParent.test(f.body) && !isReturned.test(f.body)) {
      orphans.push(v);
    }
  }
  if (orphans.length) report.push(f.startLine + ' ' + f.name + ': ' + orphans.join(', '));
}
console.log(report.length ? report.join('\n') : '(no orphan meshes detected)');
