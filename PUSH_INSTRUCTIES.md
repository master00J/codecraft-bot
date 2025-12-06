# Instructies om naar GitHub te pushen

Als de automatische push niet werkt, voer deze commando's handmatig uit in PowerShell:

## Stap 1: Controleer de huidige status
```powershell
cd "c:\Users\RTX40\Desktop\Jason\coding stuff\codecraft"
git status
git branch --show-current
git log --oneline -3
```

## Stap 2: Controleer de remotes
```powershell
git remote -v
```

Je zou moeten zien:
- `bot` → https://github.com/master00J/codecraft-bot.git
- `webapp` → https://github.com/master00J/codecraft-solutions.git

## Stap 3: Voeg alle wijzigingen toe en commit
```powershell
git add -A
git commit -m "Fix TypeScript errors and update codebase"
```

## Stap 4: Push naar beide repositories
```powershell
# Push naar codecraft-bot
git push -u bot main

# Push naar codecraft-solutions  
git push -u webapp main
```

## Als je authenticatiefouten krijgt:

### Optie 1: GitHub Personal Access Token gebruiken
1. Ga naar GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Maak een nieuwe token met `repo` rechten
3. Gebruik de token als wachtwoord bij push

### Optie 2: SSH gebruiken
```powershell
# Verander de remote URLs naar SSH
git remote set-url bot git@github.com:master00J/codecraft-bot.git
git remote set-url webapp git@github.com:master00J/codecraft-solutions.git

# Push opnieuw
git push -u bot main
git push -u webapp main
```

### Optie 3: GitHub CLI gebruiken
```powershell
# Installeer GitHub CLI als je die nog niet hebt
# Dan login:
gh auth login

# Push opnieuw
git push -u bot main
git push -u webapp main
```

## Controleer of het gelukt is
Ga naar:
- https://github.com/master00J/codecraft-bot
- https://github.com/master00J/codecraft-solutions

Je zou je laatste commits moeten zien.

