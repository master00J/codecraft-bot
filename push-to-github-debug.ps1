# Debug script om naar GitHub te pushen
cd "c:\Users\RTX40\Desktop\Jason\coding stuff\codecraft"

Write-Host "=== Git Status ===" -ForegroundColor Cyan
git status
Write-Host ""

Write-Host "=== Remotes ===" -ForegroundColor Cyan
git remote -v
Write-Host ""

Write-Host "=== Current Branch ===" -ForegroundColor Cyan
$branch = git branch --show-current
Write-Host "Branch: $branch"
Write-Host ""

Write-Host "=== Last 3 Commits ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""

Write-Host "=== Pushing to bot repository ===" -ForegroundColor Yellow
git push bot $branch 2>&1
$botExit = $LASTEXITCODE
Write-Host "Exit code: $botExit"
Write-Host ""

Write-Host "=== Pushing to webapp repository ===" -ForegroundColor Yellow
git push webapp $branch 2>&1
$webappExit = $LASTEXITCODE
Write-Host "Exit code: $webappExit"
Write-Host ""

if ($botExit -eq 0 -and $webappExit -eq 0) {
    Write-Host "✓ Both pushes successful!" -ForegroundColor Green
} else {
    Write-Host "✗ One or more pushes failed" -ForegroundColor Red
    Write-Host "Bot exit code: $botExit" -ForegroundColor Red
    Write-Host "Webapp exit code: $webappExit" -ForegroundColor Red
}

