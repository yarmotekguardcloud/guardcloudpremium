#!/usr/bin/env bash
set -euo pipefail

WIN_DIR="/mnt/c/YarmotekGuardCloud/guardcloudpremium"
LIN_DIR="\C:\Users\Moussa YARBANGA/guardcloudpremium"

echo "== GuardCloudPremium (WSL) =="
echo "WIN_DIR: \"
echo "LIN_DIR: \"

# 0) Dépendances Linux minimales
sudo apt-get update -y
sudo apt-get install -y rsync tar gzip ca-certificates curl

# 1) Node (si absent)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node: \v22.20.0"
echo "NPM : \10.9.3"

# 2) Copier le projet vers Linux FS (évite EPERM sur /mnt/c)
echo "== Sync Windows -> LinuxFS (fresh) =="
rm -rf "\"
mkdir -p "\"
cd "\"

tar --exclude='./node_modules' --exclude='./.next' --exclude='./.vercel' --exclude='./dist' --exclude='./.turbo' --exclude='./.git' -cf - . \
  | (cd "\" && tar -xf -)

cd "\"

# 3) Install + build
echo "== Clean + npm install =="
rm -rf node_modules package-lock.json .next .vercel
npm install

echo "== Verify Next =="
npx --yes next --version

echo "== Build Next =="
npm run build

echo "== next-on-pages =="
npx --yes @cloudflare/next-on-pages@1.13.16

test -d ".vercel/output/static" || (echo "❌ .vercel/output/static introuvable" && exit 1)

# 4) Auth Cloudflare (token) + deploy
if [ -z "\" ]; then
  echo ""
  echo "⚠️  COLLE TON CLOUDFLARE_API_TOKEN (il ne s'affiche pas) puis Entrée:"
  read -rs CLOUDFLARE_API_TOKEN
  echo ""
  export CLOUDFLARE_API_TOKEN
fi

echo "== Wrangler whoami =="
npx --yes wrangler@latest whoami

echo "== Deploy Pages =="
npx --yes wrangler@latest pages deploy .vercel/output/static --project-name guardcloudpremium

echo "✅ DEPLOY OK"

