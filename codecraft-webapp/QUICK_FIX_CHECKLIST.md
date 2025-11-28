# 🚨 Quick Fix Checklist - Login Loop Probleem

## Het Probleem:
Je wordt steeds teruggestuurd naar `/login?callbackUrl=/dashboard`

## ✅ Oplossing - Volg deze stappen EXACT:

### Stap 1: Genereer NEXTAUTH_SECRET

**PowerShell (Windows):**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Kopieer de output** (bijvoorbeeld: `abc123def456...xyz==`)

---

### Stap 2: Voeg toe aan Vercel

1. Ga naar: https://vercel.com/dashboard
2. Klik op project **"codecraft-solutions"**
3. Klik **"Settings"** (tab bovenaan)
4. Klik **"Environment Variables"** (links)
5. Klik **"Add New"** (rechts)

**Voeg deze 2 variables toe:**

#### Variable 1:
- **Key:** `NEXTAUTH_SECRET`
- **Value:** [plak je gegenereerde secret]
- **Environments:** ✅ Production ✅ Preview ✅ Development
- Klik **"Save"**

#### Variable 2:
- **Key:** `NEXTAUTH_URL`
- **Value:** `https://codecraft-solutions-seven.vercel.app`
- **Environments:** ✅ Production ✅ Preview ✅ Development
- Klik **"Save"**

---

### Stap 3: Update Discord Developer Portal

1. Ga naar: https://discord.com/developers/applications/1435655018169630780/oauth2
2. Scroll naar **"Redirects"**
3. **VERWIJDER de oude:**
   - Klik op **X** naast `https://codecraft-solutions-seven.vercel.app/api/auth/callback`
4. **Controleer dat deze er staat:**
   ```
   https://codecraft-solutions-seven.vercel.app/api/auth/callback/discord
   ```
5. Als deze er NIET staat, voeg toe en klik **"Add Another"**
6. **SCROLL NAAR BENEDEN** en klik **"Save Changes"** (groene knop)

---

### Stap 4: Redeploy in Vercel

1. Ga terug naar Vercel Dashboard
2. Klik op **"Deployments"** tab
3. Klik op de **nieuwste deployment**
4. Klik **3 dots menu** (···) rechtsboven
5. Klik **"Redeploy"**
6. Wacht 2-5 minuten

---

### Stap 5: Test

1. Ga naar: https://codecraft-solutions-seven.vercel.app/debug
2. Check of **"Session Status"** = `authenticated`
3. Als nog `unauthenticated` → Check de logs

**Als het werkt:**
1. Ga naar `/login`
2. Klik "Login with Discord"
3. Je wordt naar `/dashboard` gestuurd ✅

---

## 🔍 Troubleshooting

### "Still redirecting to login"

**Check Runtime Logs in Vercel:**
1. Ga naar Deployments
2. Klik op deployment
3. Klik "Runtime Logs"
4. Zoek naar errors

**Moet zien:**
```
🔧 Auth config loaded: {
  hasNextAuthSecret: true,  ← MOET TRUE ZIJN!
  hasDiscordClientId: true,
  hasDiscordClientSecret: true,
  ...
}
```

**Als hasNextAuthSecret: false:**
- NEXTAUTH_SECRET is NIET ingesteld
- Voeg toe aan Vercel en redeploy

### "Invalid OAuth2 redirect_uri"

**Discord redirect URI is fout:**
- Moet zijn: `https://codecraft-solutions-seven.vercel.app/api/auth/callback/discord`
- LET OP: `/discord` aan het einde!
- Vergeet niet "Save Changes" in Discord Portal!

---

## 📋 Checklist:

- [ ] `NEXTAUTH_SECRET` gegenereerd
- [ ] `NEXTAUTH_SECRET` toegevoegd aan Vercel
- [ ] `NEXTAUTH_URL` toegevoegd aan Vercel
- [ ] Discord redirect URI bijgewerkt naar `/api/auth/callback/discord`
- [ ] "Save Changes" geklikt in Discord Portal
- [ ] Redeployed in Vercel
- [ ] Getest via `/debug` pagina

**Zodra alle vakjes ✅ zijn → Login werkt perfect!** 🎉

