# Supabase Setup Guide

## 📋 Stap-voor-stap Instructies

### 1️⃣ Database Tables Aanmaken

1. Ga naar je **Supabase Dashboard**: https://app.supabase.com
2. Selecteer je project
3. Ga naar **SQL Editor** in het linker menu
4. Klik op **"New Query"**
5. Kopieer de volledige inhoud van `supabase-setup.sql`
6. Plak het in de SQL editor
7. Klik op **"Run"** (of druk op `Ctrl+Enter`)

✅ Je zou moeten zien: "Database setup completed successfully!"

### 2️⃣ Jezelf Admin Maken

#### Optie A: Je Discord ID vinden

1. Open Discord
2. Ga naar **User Settings** → **Advanced**
3. Schakel **"Developer Mode"** in
4. Klik met rechts op je eigen naam
5. Klik op **"Copy User ID"**
6. Dit is je Discord ID (een lang nummer zoals `123456789012345678`)

#### Optie B: Admin SQL uitvoeren

1. Ga terug naar **Supabase SQL Editor**
2. Open `make-admin.sql`
3. **Vervang** `YOUR_DISCORD_ID` met je daadwerkelijke Discord ID
4. **Vervang** `YourUsername#1234` met je Discord tag
5. **Vervang** het email adres (optioneel)
6. Klik op **"Run"**

**Voorbeeld:**
```sql
INSERT INTO public.users (discord_id, discord_tag, email, is_admin)
VALUES (
  '123456789012345678',     -- Je Discord ID
  'Jason#1234',             -- Je Discord tag  
  'jason@example.com',      -- Je email
  true                      -- Admin = true
)
ON CONFLICT (discord_id) 
DO UPDATE SET is_admin = true;
```

#### Optie C: Direct in Database Editor

1. Ga naar **Table Editor** → **users** table
2. Klik op **"Insert row"**
3. Vul in:
   - `discord_id`: Je Discord ID
   - `discord_tag`: Je Discord tag
   - `email`: Je email (optioneel)
   - `is_admin`: ✅ **TRUE**
4. Klik **"Save"**

### 3️⃣ Admin Status Verifiëren

Voer deze query uit in SQL Editor:

```sql
SELECT discord_id, discord_tag, is_admin, created_at 
FROM public.users 
WHERE is_admin = true;
```

Je zou je eigen account moeten zien met `is_admin = true` ✅

### 4️⃣ Testen

1. Log in op je website via Discord OAuth
2. Ga naar `/admin/orders`
3. Je zou de admin panel moeten zien! 🎉

Als je een error ziet:
- Check de browser console (F12)
- Check de Vercel Runtime Logs
- Verify dat je Discord ID correct is

## 🔧 Troubleshooting

### "Unauthorized - Admin access required"

**Oplossing:**
1. Controleer of je `is_admin = true` hebt in de database
2. Zorg dat je Discord ID exact overeenkomt (geen spaties, correct nummer)
3. Log uit en opnieuw in

### "User not found"

**Oplossing:**
1. Log eerst in via de normale website
2. Dan wordt je user account automatisch aangemaakt
3. Voer daarna de admin SQL uit

### "Database not configured"

**Oplossing:**
Check je Vercel Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Je Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Je service role key (secret!)

## 🔐 Security Tips

1. **NOOIT** je `SUPABASE_SERVICE_ROLE_KEY` committen naar git
2. Gebruik altijd environment variables
3. Check regelmatig wie admin is:
   ```sql
   SELECT * FROM users WHERE is_admin = true;
   ```
4. Verwijder admin rechten van oude accounts:
   ```sql
   UPDATE users SET is_admin = false WHERE discord_id = 'OLD_DISCORD_ID';
   ```

## 📊 Handige Queries

### Alle orders bekijken
```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
```

### Orders per status
```sql
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status;
```

### Recent gebruikers
```sql
SELECT discord_tag, created_at, is_admin 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

### Orders van een specifieke gebruiker
```sql
SELECT o.*, u.discord_tag 
FROM orders o
JOIN users u ON o.discord_id = u.discord_id
WHERE u.discord_tag = 'Jason#1234';
```

## 🎯 Next Steps

Na het opzetten van de database kun je:
1. ✅ Orders bekijken in `/admin/orders`
2. ✅ Test orders indienen via `/order`
3. ✅ Andere admins toevoegen
4. ✅ Discord webhook toevoegen voor notificaties

Veel succes! 🚀

