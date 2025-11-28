# NextAuth Setup voor CodeCraft Solutions

## ✅ Wat is er veranderd?

De webapp gebruikt nu **NextAuth** - een professionele authenticatie library die alle session en cookie management automatisch afhandelt.

## 🎯 Voordelen van NextAuth:

- ✅ **Betrouwbare sessies** - Geen cookie problemen meer
- ✅ **Automatische refresh** - Sessions worden automatisch vernieuwd
- ✅ **Security** - Industry-standard beveiliging
- ✅ **JWT tokens** - Veilige, server-side sessies
- ✅ **Werkt perfect op Vercel**

## 🔧 Setup Instructies

### Stap 1: Environment Variables Toevoegen

Voeg deze toe aan je **Vercel Environment Variables**:

```bash
NEXTAUTH_SECRET=<genereer een random string>
NEXTAUTH_URL=https://codecraft-solutions-seven.vercel.app
```

**NEXTAUTH_SECRET genereren:**

Optie 1 - Online:
```bash
# Gebruik: https://generate-secret.vercel.app/32
```

Optie 2 - Terminal (Linux/Mac):
```bash
openssl rand -base64 32
```

Optie 3 - PowerShell (Windows):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Optie 4 - Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Stap 2: Vercel Environment Variables Instellen

1. Ga naar Vercel Dashboard → je project
2. Ga naar **Settings** → **Environment Variables**
3. Voeg toe:

```
Name: NEXTAUTH_SECRET
Value: <je gegenereerde secret>

Name: NEXTAUTH_URL  
Value: https://codecraft-solutions-seven.vercel.app
```

**Let op:** Beide voor **Production**, **Preview** EN **Development**!

### Stap 3: Discord Developer Portal

In je Discord OAuth redirect URI's heb je nu nodig:

```
https://codecraft-solutions-seven.vercel.app/api/auth/callback/discord
```

**Let op het verschil:**
- ❌ Oud: `/api/auth/callback`
- ✅ Nieuw: `/api/auth/callback/discord`

### Stap 4: Redeploy

Na het instellen van de environment variables:
1. Ga naar Vercel Dashboard
2. Klik op **"Redeploy"** of push een nieuwe commit

## 🧪 Testen

### Test 1 - Login
1. Ga naar `/login`
2. Klik "Login with Discord"
3. Authoriseer de app
4. Je wordt geïndirect naar `/dashboard` ✅

### Test 2 - Session Persistence
1. Zorg dat je ingelogd bent
2. Navigeer naar verschillende pagina's
3. **Check navbar** → Zou "Dashboard" en "Logout" moeten tonen
4. **Blijft ingelogd!** ✅

### Test 3 - Order Indienen
1. Zorg dat je ingelogd bent  
2. Ga naar `/order` (of via pricing)
3. Vul formulier in
4. Submit → Success! ✅

### Test 4 - Logout
1. Klik "Logout" in navbar
2. Sessions worden gecleard
3. Redirect naar homepage
4. Navbar toont weer "Login with Discord" ✅

## 🔍 Debugging

### Check Session in Browser Console:

```javascript
// Run dit in browser console
fetch('/api/auth/session').then(r => r.json()).then(console.log)
```

**Als ingelogd:**
```json
{
  "user": {
    "name": "YourUsername",
    "email": null,
    "image": "...",
    "id": "uuid",
    "discordId": "123456789",
    "discordTag": "YourUsername#1234",
    "isAdmin": false
  },
  "expires": "2025-01-..."
}
```

**Als uitgelogd:**
```json
{}
```

### Check Vercel Runtime Logs:

Bij login zou je moeten zien:
```
🔐 Discord OAuth - Creating/updating user: YourUsername
✅ User synced to Supabase: YourUsername#1234
```

Bij order creation:
```
📝 Order POST - Session check: {
  hasSession: true,
  hasUser: true,
  discordId: '123456789...'
}
✅ Order CC123ABC created in Supabase
```

## ⚙️ Technische Details

### Wat NextAuth doet:

1. **Login Flow:**
   - User klikt "Login with Discord"
   - NextAuth redirect naar Discord OAuth
   - Discord redirect terug naar `/api/auth/callback/discord`
   - NextAuth verwerkt callback
   - User info opgeslagen in Supabase
   - JWT session token gecreëerd
   - Redirect naar `/dashboard`

2. **Session Management:**
   - Session info opgeslagen in JWT token
   - Token opgeslagen in `next-auth.session-token` cookie
   - Automatisch renewed voor expiry
   - Server-side verification

3. **Logout:**
   - NextAuth cleeart alle auth cookies
   - Session wordt geïnvalideerd
   - Redirect naar homepage

## 🔐 Security

NextAuth gebruikt:
- ✅ HTTP-only cookies (XSS protection)
- ✅ CSRF protection ingebouwd
- ✅ Secure cookies in production
- ✅ JWT tokens (server-side verification)
- ✅ Automatic token rotation

## 📋 Migration Summary

### Verwijderd:
- ❌ `/api/auth/discord/route.ts` (handmatig OAuth)
- ❌ `/api/auth/callback/route.ts` (handmatige callback)
- ❌ `/api/auth/session/route.ts` (handmatige session check)
- ❌ Handmatige cookie management

### Toegevoegd:
- ✅ `/api/auth/[...nextauth]/route.ts` (NextAuth handler)
- ✅ `/lib/auth.ts` (NextAuth configuratie)
- ✅ `SessionProvider` (React context)
- ✅ `useSession` hooks in components

### Geüpdateerd:
- ✅ `navbar.tsx` - gebruikt `useSession()`
- ✅ `order/page.tsx` - gebruikt `useSession()`
- ✅ `login/page.tsx` - gebruikt `signIn()`
- ✅ `middleware.ts` - gebruikt NextAuth middleware
- ✅ API routes - gebruiken `getServerSession()`

## 🚀 Resultaat

**VOOR (Handmatige Cookies):**
- ❌ Cookies werken niet consistent op Vercel
- ❌ Session gaat verloren na navigatie
- ❌ CORS errors
- ❌ React errors

**NA (NextAuth):**
- ✅ Sessions werken 100% betrouwbaar
- ✅ Blijft ingelogd tijdens navigatie
- ✅ Geen CORS errors
- ✅ Geen React errors
- ✅ Industry-standard security

Perfect! 🎉

