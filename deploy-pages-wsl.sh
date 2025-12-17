#!/usr/bin/env bash
set -euo pipefail

echo "== GuardCloudPremium (WSL): build + next-on-pages + deploy =="

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "❌ CLOUDFLARE_API_TOKEN manquant."
  echo "   (Le script PowerShell le passe automatiquement si tu le définis côté Windows)"
  exit 1
fi

cd "$HOME/guardcloudpremium"

echo "-> Clean"
rm -rf node_modules package-lock.json .next .vercel

echo "-> Install"
npm install

echo "-> Check Next"
npx next --version

echo "-> Build"
npm run build

echo "-> next-on-pages"
npx @cloudflare/next-on-pages@1.13.16

echo "-> Deploy"
npx wrangler@latest pages deploy .vercel/output/static --project-name guardcloudpremium

echo "✅ OK"
