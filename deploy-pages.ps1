# deploy-pages.ps1 (RADICAL - WSL LinuxFS build + next-on-pages + deploy)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Fail([string]$msg) {
  Write-Host "
âŒ $msg
" -ForegroundColor Red
  exit 1
}

function Run([string]$exe, [string[]]$args) {
  $out = & $exe @args 2>&1
  $code = $LASTEXITCODE
  return @{ Out = $out; Code = $code }
}

Write-Host "
== GuardCloudPremium: WSL LinuxFS build + next-on-pages + deploy ==
"

if (-not (Test-Path ".\package.json")) {
  Fail "Lance ce script depuis: C:\YarmotekGuardCloud\guardcloudpremium"
}

# --- WSL distros ---
$r = Run "wsl.exe" @("-l","-q")
if ($r.Code -ne 0) { Fail "WSL ne rÃ©pond pas. Lance: wsl --shutdown puis relance." }

$distros = @($r.Out | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ -ne "" })
if ($distros.Count -eq 0) { Fail "Aucune distro WSL trouvÃ©e. Installe Ubuntu-24.04 puis relance." }

$distro = ($distros | Where-Object { $_ -eq "Ubuntu-24.04" } | Select-Object -First 1)
if (-not $distro) { $distro = $distros[0] }

Write-Host "-> WSL distros : $($distros -join ', ')"
Write-Host "-> Using distro : $distro"

# Set default distro (important)
$r = Run "wsl.exe" @("-s", $distro)
if ($r.Code -ne 0) { Fail "Impossible de dÃ©finir la distro par dÃ©faut ($distro). ExÃ©cute: wsl -l -v" }

# bash ok?
$r = Run "wsl.exe" @("--","bash","-lc","echo OK")
if ($r.Code -ne 0) { Fail "WSL OK mais bash indisponible. Ouvre Ubuntu et lance: sudo apt-get update" }

# Paths
$projectWin = (Resolve-Path ".").Path
$projectWsl = "/mnt/" + $projectWin.Substring(0,1).ToLower() + ($projectWin.Substring(2) -replace "\\","/")

Write-Host "-> Windows path : $projectWin"
Write-Host "-> WSL path     : $projectWsl"
Write-Host "-> Linux dir    : $HOME/guardcloudpremium"

# Token: prompt (secure)
$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) {
  $secure = Read-Host "Lm5FV2c3ZeeEnLq8aI1qA2LUjszAx3lDu45YQfTJ" -AsSecureString
  if (-not $secure) { Fail "Token requis." }
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $token -or $token.Trim().Length -lt 20) { Fail "Token Cloudflare invalide (trop court)." }

$tokenB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($token))

# Bash payload (LinuxFS, Ã©vite EPERM sur /mnt/c)
$bash = @'
set -euo pipefail

WIN_DIR="%%WIN_DIR%%"
LIN_DIR="C:\Users\Moussa YARBANGA/guardcloudpremium"
TOKEN_B64="%%TOKEN_B64%%"

echo "== WSL ENV =="
echo "WIN_DIR: "
echo "LIN_DIR: "

sudo apt-get update -y
sudo apt-get install -y rsync ca-certificates curl git tar gzip coreutils

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

node -v
npm -v

echo "== Fresh sync Windows -> LinuxFS =="
rm -rf ""
mkdir -p ""
cd ""

tar --exclude='./node_modules' --exclude='./.next' --exclude='./.vercel' --exclude='./dist' --exclude='./.turbo' --exclude='./.git' -cf - . \
  | (cd "" && tar -xf -)

cd ""

echo "== Clean + install (LinuxFS) =="
rm -rf node_modules package-lock.json .next .vercel
npm install

echo "== Verify Next =="
npx --yes next --version

echo "== Build =="
npm run build

echo "== next-on-pages =="
npx --yes @cloudflare/next-on-pages@1.13.16

test -d ".vercel/output/static" || (echo "âŒ .vercel/output/static introuvable" && exit 1)

export CLOUDFLARE_API_TOKEN=""
npx --yes wrangler@latest whoami

echo "== Deploy Pages =="
npx --yes wrangler@latest pages deploy .vercel/output/static --project-name guardcloudpremium

echo "âœ… DEPLOY OK"
'@

$bash = $bash.Replace("%%WIN_DIR%%", $projectWsl).Replace("%%TOKEN_B64%%", $tokenB64)
$bashLF = $bash -replace "",""
$bashB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bashLF))

Write-Host "
-> Run WSL build/deploy...
"
$r = Run "wsl.exe" @("--","bash","-lc","echo '$bashB64' | base64 -d | bash")
$r.Out | ForEach-Object { $_ }
if ($r.Code -ne 0) { Fail "WSL build/deploy Ã©chouÃ©. Lis le log ci-dessus." }

Write-Host "
âœ… TerminÃ©.
" -ForegroundColor Green
