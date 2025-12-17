const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function patchRuntimeEdge(file) {
  let s = fs.readFileSync(file, "utf8");

  // 1) si runtime=nodejs -> runtime=edge
  const before = s;
  s = s.replace(/export\s+const\s+runtime\s*=\s*(['"])nodejs\1\s*;?/g, "export const runtime = 'edge';");
  s = s.replace(/export\s+const\s+runtime\s*=\s*(['"])experimental-edge\1\s*;?/g, "export const runtime = 'edge';");

  // 2) si runtime déjà présent (edge ou autre) -> ok
  if (/export\s+const\s+runtime\s*=/.test(s)) {
    if (s !== before) fs.writeFileSync(file, s);
    return s !== before;
  }

  // 3) ne pas toucher les fichiers "use client"
  if (/^(['"])use client\1\s*;?\s*\r?\n/.test(s)) return false;

  const insert = "export const runtime = 'edge';\n\n";

  // 4) insérer après le bloc d'imports si possible
  const importBlock = /^(?:\s*import[\s\S]*?;\s*\r?\n)+/;
  const im = s.match(importBlock);
  if (im) {
    const idx = im[0].length;
    s = s.slice(0, idx) + "\n" + insert + s.slice(idx);
  } else {
    s = insert + s;
  }

  fs.writeFileSync(file, s);
  return true;
}

const changed = [];

// A) app/layout.tsx -> runtime=edge (couvre /client/activate et les autres pages dynamiques)
const layout = path.join("app", "layout.tsx");
if (fs.existsSync(layout) && patchRuntimeEdge(layout)) changed.push(layout);

// B) toutes les API routes -> runtime=edge
const apiDir = path.join("app", "api");
for (const f of walk(apiDir)) {
  const norm = f.replace(/\\/g, "/");
  if (/\/route\.(ts|tsx|js|jsx)$/.test(norm)) {
    if (patchRuntimeEdge(f)) changed.push(f);
  }
}

console.log(" Patched files:", changed.length);
for (const f of changed) console.log(" -", f);
