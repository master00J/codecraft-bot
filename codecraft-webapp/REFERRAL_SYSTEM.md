# 🎁 Affiliate/Referral Systeem

Een volledig affiliate programma waarbij gebruikers beloond worden voor het doorverwijzen van nieuwe Enterprise klanten.

## 📋 Overzicht

**Reward:** 1 week gratis Enterprise tier  
**Voorwaarde:** Doorverwezen gebruiker moet minstens 1 maand Enterprise tier kopen

## 🏗️ Architectuur

### Database Schema

Het systeem bestaat uit 4 hoofdtabellen:

1. **`referral_codes`** - Unieke referral codes per gebruiker
2. **`referrals`** - Tracking van clicks, signups en conversies  
3. **`referral_rewards`** - Uitgedeelde rewards en hun status
4. **`referral_settings`** - Globale configuratie

**Zie:** `codecraft-webapp/referral-system-schema.sql`

### API Routes

#### User Facing
- `GET /api/comcraft/referral/code` - Verkrijg/genereer referral code
- `PATCH /api/comcraft/referral/code` - Regenereer code
- `GET /api/comcraft/referral/stats` - Verkrijg statistieken

#### Public (Tracking)
- `POST /api/comcraft/referral/track` - Track clicks en signups

#### Internal
- `POST /api/comcraft/referral/convert` - Verwerk conversie en deel reward uit
- `POST /api/comcraft/subscriptions/upgrade` - Subscription upgrade (detecteert conversies)

### Frontend Components

**Dashboard:** `/dashboard/referrals`
- Persoonlijke referral link
- Statistieken (clicks, signups, conversies, rewards)
- Recente referrals overzicht
- Actieve rewards tracker

**Tracking:** `<ReferralTracker />` component
- Automatische click tracking via URL parameter `?ref=CODE`
- Automatische signup tracking bij authenticatie
- Client-side sessie storage voor deduplicatie

## 🚀 Setup

### 1. Database Migratie

Run in Supabase SQL Editor:

```bash
codecraft-webapp/referral-system-schema.sql
```

Dit creëert:
- ✅ 4 tabellen met indexes
- ✅ Row Level Security policies
- ✅ Helper functies (generate_referral_code, apply_referral_reward, expire_referral_rewards)
- ✅ Triggers voor timestamp updates

### 2. Environment Variables

Voeg toe aan `.env.local` (webapp):

```env
# Voor inter-service communicatie
INTERNAL_API_SECRET=your-secret-key-here
NEXT_PUBLIC_URL=https://your-domain.com
```

### 3. Frontend Integratie

Voeg `<ReferralTracker />` toe aan je root layout:

```tsx
// src/app/layout.tsx
import { ReferralTracker } from '@/components/ReferralTracker';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Suspense fallback={null}>
          <ReferralTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
```

### 4. Payment Integration

Bij elke Enterprise purchase, roep aan:

```typescript
// Example: After successful payment
await fetch('/api/comcraft/subscriptions/upgrade', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    guildId: 'xxx',
    tier: 'enterprise',
    duration: 1, // months
    price: 29.99
  })
});
```

De API detecteert automatisch of het een referral conversie is en deelt de reward uit.

## 📊 Hoe Het Werkt

### Flow voor Referrer (degene die deelt)

1. **Verkrijg Link:** Ga naar `/dashboard/referrals` en kopieer je unieke link
2. **Deel Link:** Deel via social media, Discord, email, etc.
3. **Track Progress:** Zie real-time statistieken in je dashboard
4. **Ontvang Reward:** Automatisch 1 week gratis Enterprise bij conversie

### Flow voor Referred User (degene die klikt)

1. **Klik Link:** Bezoekt site via `https://yourdomain.com?ref=CODE`
2. **Track Click:** Systeem registreert de click (sessie cookie)
3. **Sign Up:** Meld aan via Discord OAuth
4. **Track Signup:** Systeem koppelt Discord ID aan referral
5. **Purchase Enterprise:** Koopt minstens 1 maand Enterprise
6. **Conversion!** Referrer krijgt automatisch 1 week gratis

## 🔒 Fraud Prevention

Het systeem bevat meerdere beschermingen:

1. **Self-Referral Block:** Gebruikers kunnen zichzelf niet doorverwijzen
2. **IP Tracking:** Duplicaat clicks vanuit zelfde IP binnen 24u worden genegeerd
3. **Sessie Deduplicatie:** Browser sessie storage voorkomt dubbele tracking
4. **Conversion Requirements:** Alleen Enterprise tier ≥1 maand telt mee
5. **One-Time Rewards:** Elke referral kan maar 1x een reward geven

## 💾 Database Functies

### `generate_referral_code(p_discord_tag TEXT)`
Genereert unieke code gebaseerd op username + jaar.

**Voorbeeld:** "EMMA2024" of "EMMA202412" (bij conflict)

### `apply_referral_reward(p_referrer_discord_id, p_referrer_guild_id, p_referral_id, p_referred_discord_id)`
Past de 1-week Enterprise reward toe:

1. Back-upt huidige subscription tier
2. Upgrade naar Enterprise voor 7 dagen
3. Creëert reward record
4. Markeert referral als "rewarded"
5. Update referral code statistieken

### `expire_referral_rewards()`
Cron job functie (run dagelijks):

1. Vindt verlopen rewards (expires_at < NOW)
2. Herstelt originele subscription tier
3. Markeert reward als inactief

**Setup Cron:**

```sql
-- Supabase Edge Function of externe cron
SELECT expire_referral_rewards();
```

## 📈 Statistieken & Reporting

### Key Metrics

De `/stats` API retourneert:

```typescript
{
  code: "EMMA2024",
  totalClicks: 150,
  totalSignups: 45,
  totalConversions: 12,
  totalRewards: 12,
  conversionRate: "8.00%",
  totalEarnings: {
    days: 84,      // 12 rewards × 7 days
    value: 359.88  // 12 × €29.99
  }
}
```

### Database Queries

**Top Referrers:**
```sql
SELECT discord_id, total_conversions, total_rewards_earned
FROM referral_codes
WHERE is_active = true
ORDER BY total_conversions DESC
LIMIT 10;
```

**Conversion Funnel:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE conversion_status = 'clicked') as clicks,
  COUNT(*) FILTER (WHERE conversion_status = 'signed_up') as signups,
  COUNT(*) FILTER (WHERE conversion_status = 'converted') as conversions
FROM referrals
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Active Rewards:**
```sql
SELECT COUNT(*), SUM(reward_duration) as total_days
FROM referral_rewards
WHERE is_active = true AND expires_at > NOW();
```

## 🎨 UI Componenten

### Dashboard Features

1. **Referral Link Card**
   - Copy to clipboard button
   - Social share buttons (Twitter, Discord)
   - Code regeneration

2. **Stats Grid**
   - Total Clicks
   - Total Signups
   - Conversions + Rate
   - Rewards Earned

3. **Earnings Display**
   - Total value in euros
   - Total days of free service

4. **Active Rewards List**
   - Expiry countdown
   - Guild information

5. **Recent Referrals Table**
   - Status indicators
   - Conversion tracking
   - Reward confirmation

## 🔧 Maintenance

### Reward Expiry

Setup een dagelijkse cron job:

```bash
# Supabase Edge Function (scheduled)
curl -X POST 'https://yourproject.supabase.co/rest/v1/rpc/expire_referral_rewards' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Monitoring

**Check for stuck rewards:**
```sql
SELECT * FROM referral_rewards
WHERE is_active = true AND expires_at < NOW() - INTERVAL '1 day';
```

**Audit trail:**
```sql
SELECT 
  r.referral_code,
  r.conversion_status,
  r.reward_given,
  rr.expires_at,
  gc.subscription_tier
FROM referrals r
LEFT JOIN referral_rewards rr ON rr.referral_id = r.id
LEFT JOIN guild_configs gc ON gc.owner_discord_id = r.referrer_discord_id
WHERE r.converted_at IS NOT NULL
ORDER BY r.converted_at DESC;
```

## 🐛 Troubleshooting

### Conversie wordt niet getriggerd

1. **Check logs:** `/api/comcraft/subscriptions/upgrade` response
2. **Verify tier:** Moet exact "enterprise" zijn
3. **Check duration:** ≥1 maand required
4. **Verify referral exists:** Query `referrals` tabel voor referred_discord_id

### Reward wordt niet toegepast

1. **Check referral status:** Moet "signed_up" of "clicked" zijn
2. **Verify no duplicate:** `reward_given` = false
3. **Check guild exists:** Referrer moet een guild hebben
4. **Test function:** Run `apply_referral_reward` manually

### Tracking werkt niet

1. **Check session storage:** Browser console → Application → Session Storage
2. **Verify API calls:** Network tab → Filter "/referral/track"
3. **Check URL parameter:** Moet `?ref=CODE` bevatten
4. **Test with incognito:** Nieuwe sessie zonder cache

## 📝 Toekomstige Verbeteringen

- [ ] Email notificaties bij nieuwe conversies
- [ ] Discord DM notificaties voor referrers
- [ ] Tiered rewards (5 conversies = extra bonus)
- [ ] Leaderboard pagina
- [ ] Custom referral vanity URLs
- [ ] A/B testing voor verschillende rewards
- [ ] Lifetime value tracking per referral
- [ ] Referral contests/campaigns

## 🤝 Support

Voor vragen of problemen:
- Check deze documentatie
- Review database logs
- Test met testaccounts in incognito mode
- Contact admin voor database queries

---

**Built with:** Next.js 14, Supabase, TypeScript  
**Version:** 1.0.0  
**Last Updated:** November 2024

