# Script om naar beide GitHub repositories te pushen
cd "c:\Users\RTX40\Desktop\Jason\coding stuff\codecraft"

Write-Host "=== Git Status Controleren ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Remotes Controleren ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== Bestanden Toevoegen ===" -ForegroundColor Cyan
git add -A
git status --short

Write-Host "`n=== Committen ===" -ForegroundColor Cyan
$commitMessage = "Update codebase - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMessage

Write-Host "`n=== Huidige Branch Controleren ===" -ForegroundColor Cyan
$currentBranch = git branch --show-current
Write-Host "Huidige branch: $currentBranch" -ForegroundColor Yellow

if (-not $currentBranch) {
    Write-Host "Geen branch gevonden, main branch maken..." -ForegroundColor Yellow
    git branch -M main
    $currentBranch = "main"
}

Write-Host "`n=== Pushen naar codecraft-bot ===" -ForegroundColor Cyan
git push -u bot $currentBranch
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Succesvol gepusht naar codecraft-bot" -ForegroundColor Green
} else {
    Write-Host "✗ Fout bij pushen naar codecraft-bot" -ForegroundColor Red
}

Write-Host "`n=== Pushen naar codecraft-solutions ===" -ForegroundColor Cyan
git push -u webapp $currentBranch
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Succesvol gepusht naar codecraft-solutions" -ForegroundColor Green
} else {
    Write-Host "✗ Fout bij pushen naar codecraft-solutions" -ForegroundColor Red
}

Write-Host "`n=== Klaar! ===" -ForegroundColor Cyan

