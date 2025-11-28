# Live Chat Widget Setup

## Overzicht

De live chat widget is een realtime support systeem waarbij **iedereen** (ook niet-ingelogde bezoekers) direct met admins kunnen chatten via een floating widget op de website.

### Functies

**Voor klanten/gasten:**
- ✅ **Anonieme chat** - Geen login vereist!
- ✅ Floating chat button rechtsonder op alle pagina's
- ✅ Realtime berichten met Supabase
- ✅ **Dynamische response tijd** - Ziet hoe snel support reageert
- ✅ Notificaties voor nieuwe admin berichten
- ✅ Minimaliseren/maximaliseren van de chat
- ✅ Chat history opslaan (via localStorage guest_id)

**Voor admins:**
- Volledig chat management dashboard op `/admin/chat`
- Overzicht van alle actieve conversaties
- Realtime berichten ontvangen en versturen
- Filter op status (open/waiting/closed)
- User info en chat geschiedenis

## Database Setup

### 1. Run de SQL schemas (beide!)

Ga naar je Supabase project → SQL Editor en voer **beide** bestanden uit:

**Stap 1: Basis schema**
```bash
codecraft-webapp/chat-system-schema.sql
```

**Stap 2: Anonieme chat + response tracking**
```bash
codecraft-webapp/chat-system-schema-v2.sql
```

Dit maakt de volgende aan:
- `chat_conversations` - Alle chat conversaties (met guest support)
- `chat_messages` - Alle berichten
- Response time tracking (automatisch berekend)
- `chat_response_stats` view - Real-time statistieken

### 2. Enable Realtime in Supabase

De schema script heeft dit al voor je gedaan! Het activeert Realtime voor beide tabellen zodat berichten instant verschijnen.

### 3. Row Level Security (RLS)

De RLS policies zijn al ingesteld:
- ✅ **Anonieme gasten** kunnen chat starten zonder login
- ✅ Gasten krijgen unieke `guest_id` (opgeslagen in browser localStorage)
- ✅ Klanten kunnen alleen hun eigen conversaties en berichten zien
- ✅ Admins kunnen alle conversaties en berichten zien/beheren
- ✅ Iedereen kan berichten verzenden in hun eigen conversations

### 4. Response Time Tracking

De v2 schema bevat een **automatische trigger** die:
- ⏱️ Meet het verschil tussen eerste customer bericht en eerste admin reply
- 📊 Berekent gemiddelde response tijd over laatste 30 dagen
- 🎯 Toont real-time statistiek in chat header ("Gemiddelde reactietijd: X minuten")

## Component Structuur

### Frontend Componenten

1. **`/components/chat-widget.tsx`** - De floating chat widget voor klanten
   - Altijd zichtbaar op customer pages (als ingelogd)
   - Realtime updates via Supabase
   - Unread message counter
   
2. **`/app/admin/chat/page.tsx`** - Admin chat dashboard
   - Conversaties lijst
   - Realtime message feed
   - Multi-conversation support

### API Routes

1. **`/api/chat/init`** - Initialiseer/laad een chat conversatie (POST)
2. **`/api/chat/messages`** - Verstuur een bericht (POST)
3. **`/api/admin/chat/conversations`** - Fetch alle conversaties (GET, admin only)
4. **`/api/admin/chat/conversations/[id]`** - Fetch berichten van een conversatie (GET, admin only)

## Hoe te gebruiken

### Als klant/gast:

1. **Geen login nodig!** - Open gewoon de website
2. Klik op de chat button rechtsonder (🟢 groene cirkel)
3. Type je bericht en verstuur
4. Zie de gemiddelde response tijd in de header
5. Wacht op admin response (krijg notificatie als admin antwoordt)
6. Chat blijft opgeslagen via browser localStorage

### Als admin:

1. Ga naar `/admin/chat`
2. Zie alle actieve conversaties in de linker kolom (zowel van users als gasten)
3. Gasten worden getoond als "Guest" of met hun guest_id
4. Klik op een conversatie om berichten te zien
5. Type je antwoord en verstuur
6. **Je response tijd wordt automatisch getracked!**
7. Klant krijgt instant de reply via Realtime

## Aanpassingen

### Wijzig chat kleuren:

In `/components/chat-widget.tsx`:
```tsx
// Header kleur
<div className="... bg-primary text-primary-foreground">

// Eigen berichten
<div className="bg-primary text-primary-foreground">

// Admin berichten  
<div className="bg-muted">
```

### Disable chat voor niet-ingelogde users:

Chat widget toont zich alleen als `session.status === "authenticated"`. Dit is al standaard ingesteld.

### Verberg chat op specifieke paginas:

In `/app/layout.tsx`, voeg conditional rendering toe:
```tsx
{!pathname.includes('/some-path') && <ChatWidget />}
```

## Troubleshooting

### Widget verschijnt niet?

1. Check of je ingelogd bent
2. Check console voor errors
3. Verifieer dat Supabase Realtime enabled is (Database → Replication → check chat tables)

### Berichten komen niet door?

1. Controleer RLS policies in Supabase
2. Check of `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` correct zijn ingesteld
3. Verifieer in Network tab dat API calls slagen

### Realtime werkt niet?

1. Ga naar Supabase → Database → Replication
2. Zorg dat `chat_messages` en `chat_conversations` enabled zijn
3. Herstart je development server

## Best Practices

- ✅ **Anonieme gasten** kunnen chatten zonder account
- ✅ Guest ID wordt opgeslagen in localStorage (persistent over page refreshes)
- ✅ Chat blijft open tussen page navigaties
- ✅ Messages worden opgeslagen in database (geen data loss)
- ✅ **Response tijd wordt automatisch gemeten** en getoond
- ✅ Admins kunnen meerdere chats tegelijk beheren
- ✅ Notificaties voor nieuwe berichten
- ✅ Mobile responsive design
- ✅ Realtime updates via Supabase (postgres_changes + broadcast)

## Unieke Features ⭐

1. **Geen login barrier** - Gasten kunnen direct chatten
2. **Smart guest tracking** - Via localStorage guest_id
3. **Real-time response stats** - "We reageren gemiddeld binnen X minuten"
4. **Auto-calculated** - Response tijd wordt automatisch gemeten via database trigger
5. **Dual realtime** - Postgres changes + broadcast voor instant updates

## Volgende stappen (optioneel)

- 📧 Email notificaties naar admins bij nieuwe chat
- 🔔 Push notifications
- 📎 File upload in chat
- 🤖 Auto-reply/chatbot voor veelgestelde vragen
- 💬 Optioneel email vragen voor follow-up (voor gasten)
- 📊 Extended analytics (satisfaction ratings, peak hours)

