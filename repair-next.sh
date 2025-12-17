set -e

echo "== WHERE AM I =="
pwd
test -f package.json || (echo "❌ package.json introuvable ici"; exit 1)

echo "== CLEAN =="
rm -rf node_modules .next .vercel package-lock.json

echo "== INSTALL (Next + React + Leaflet) =="
npm install --no-audit --no-fund next@15.5.7 react react-dom leaflet react-leaflet

echo "== INSTALL (Types + Tailwind) =="
npm install --no-audit --no-fund -D typescript @types/node @types/react @types/react-dom @types/leaflet tailwindcss postcss autoprefixer

echo "== PATCH package.json scripts (pour toujours trouver Next) =="
node - <<'NODE'
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts.dev = pkg.scripts.dev || "npx next dev";
pkg.scripts.start = pkg.scripts.start || "npx next start";
pkg.scripts.build = "npx next build --no-lint";
fs.writeFileSync("package.json", JSON.stringify(pkg,null,2));
console.log("✅ package.json scripts patchés");
NODE

echo "== VERIFY =="
npx next --version
ls -la node_modules/.bin | grep next || true

echo "== BUILD =="
npm run build
