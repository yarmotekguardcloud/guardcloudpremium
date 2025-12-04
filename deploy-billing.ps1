param(
    [string]$ProjectPath = "C:\YarmotekGuardCloud\guardcloudpremium"
)

Write-Host "=== Deploy Yarmotek GuardCloud Billing ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath" -ForegroundColor DarkGray

# 1) Aller dans le projet
Set-Location $ProjectPath

# 2) Nettoyage du dossier .next / .turbo (build précédent)
Write-Host "Cleaning .next..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item ".next" -Recurse -Force
}

Write-Host "Cleaning .turbo..." -ForegroundColor Yellow
if (Test-Path ".turbo") {
    Remove-Item ".turbo" -Recurse -Force
}

# 3) Installation des dépendances
Write-Host "Installing dependencies (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "npm install failed." -ForegroundColor Red
    exit 1
}

# 4) Build Next.js (production)
Write-Host "Building (npm run build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build terminé avec succès." -ForegroundColor Green
Write-Host "Dossier de build: .next" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester en local : " -ForegroundColor Cyan
Write-Host "  cd $ProjectPath" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour déployer sur Cloudflare Pages / autre : " -ForegroundColor Cyan
Write-Host "  - Commande de build : npm run build" -ForegroundColor Cyan
Write-Host "  - Dossier d'output : .next" -ForegroundColor Cyan
