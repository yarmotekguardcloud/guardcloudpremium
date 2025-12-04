# install-leaflet-icons.ps1
Param(
    [string]$ProjectRoot = "C:\YarmotekGuardCloud\guardcloudpremium"
)

Write-Host "Using project root: $ProjectRoot"

$leafletImages = Join-Path $ProjectRoot "node_modules\leaflet\dist\images"
$publicMap     = Join-Path $ProjectRoot "public\map"

if (-not (Test-Path $leafletImages)) {
    Write-Host "ERROR: Leaflet images folder not found:"
    Write-Host "  $leafletImages"
    Write-Host "Run 'npm install leaflet' in the project first."
    exit 1
}

if (-not (Test-Path $publicMap)) {
    Write-Host "Creating folder: $publicMap"
    New-Item -ItemType Directory -Path $publicMap | Out-Null
}

Write-Host "Copying Leaflet icons to /public/map ..."
Copy-Item (Join-Path $leafletImages "marker-icon.png")      $publicMap -Force
Copy-Item (Join-Path $leafletImages "marker-icon-2x.png")   $publicMap -Force
Copy-Item (Join-Path $leafletImages "marker-shadow.png")    $publicMap -Force

Write-Host "Done. Icons installed in:"
Write-Host "  $publicMap"
