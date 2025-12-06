# Script om naar beide GitHub repositories te pushen
cd "c:\Users\RTX40\Desktop\Jason\coding stuff\codecraft"

Write-Host "=== Git Status ===" -ForegroundColor Cyan
git status
Write-Host ""

Write-Host "=== Remotes ===" -ForegroundColor Cyan
git remote -v
Write-Host ""

Write-Host "=== Huidige Branch ===" -ForegroundColor Cyan
$branch = git branch --show-current
Write-Host "Branch: $branch"
Write-Host ""

Write-Host "=== Laatste 3 Commits ===" -ForegroundColor Cyan
git log --oneline -3
Write-Host ""

Write-Host "=== Uncommitted Changes ===" -ForegroundColor Cyan
git status --short
Write-Host ""

# Voeg alle wijzigingen toe
Write-Host "=== Bestanden Toevoegen ===" -ForegroundColor Cyan
git add -A
$status = git status --short
if ($status) {
    Write-Host "Wijzigingen gevonden:" -ForegroundColor Yellow
    Write-Host $status
    Write-Host ""
    
    Write-Host "=== Committen ===" -ForegroundColor Cyan
    git commit -m "Fix TypeScript errors and add /close and /unlock Discord commands"
    Write-Host ""
} else {
    Write-Host "Geen wijzigingen om te committen" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=== Commits die nog niet gepusht zijn naar bot ===" -ForegroundColor Cyan
$botCommits = git log --oneline bot/main..HEAD 2>&1
if ($botCommits) {
    Write-Host $botCommits
} else {
    Write-Host "Geen nieuwe commits voor bot" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== Commits die nog niet gepusht zijn naar webapp ===" -ForegroundColor Cyan
$webappCommits = git log --oneline webapp/main..HEAD 2>&1
if ($webappCommits) {
    Write-Host $webappCommits
} else {
    Write-Host "Geen nieuwe commits voor webapp" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== Pushen naar bot repository ===" -ForegroundColor Yellow
$botOutput = git push bot main 2>&1
Write-Host $botOutput
$botExit = $LASTEXITCODE
Write-Host "Exit code: $botExit"
if ($botExit -eq 0) {
    Write-Host "✓ Succesvol gepusht naar codecraft-bot" -ForegroundColor Green
} else {
    Write-Host "✗ Fout bij pushen naar codecraft-bot" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Pushen naar webapp repository ===" -ForegroundColor Yellow
$webappOutput = git push webapp main 2>&1
Write-Host $webappOutput
$webappExit = $LASTEXITCODE
Write-Host "Exit code: $webappExit"
if ($webappExit -eq 0) {
    Write-Host "✓ Succesvol gepusht naar codecraft-solutions" -ForegroundColor Green
} else {
    Write-Host "✗ Fout bij pushen naar codecraft-solutions" -ForegroundColor Red
}
Write-Host ""

if ($botExit -eq 0 -and $webappExit -eq 0) {
    Write-Host "=== Klaar! ===" -ForegroundColor Green
} else {
    Write-Host "=== Er zijn fouten opgetreden ===" -ForegroundColor Red
    Write-Host "Bot exit code: $botExit" -ForegroundColor Red
    Write-Host "Webapp exit code: $webappExit" -ForegroundColor Red
}
