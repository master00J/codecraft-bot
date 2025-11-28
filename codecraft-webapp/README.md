# CodeCraft Solutions WebApp

Een moderne Next.js webapp geïntegreerd met de CodeCraft Discord bot.

## 🚀 Features

### Public Website
- Landing page met services showcase
- Portfolio pagina
- Pricing informatie
- Contact formulier

### Customer Portal
- Discord OAuth login
- Orders bekijken en volgen
- Support tickets
- Invoices downloaden
- Real-time project updates

### Admin Dashboard
- Orders beheren
- Analytics & statistieken
- Customer management
- Revenue tracking
- Bot configuratie

## 📦 Tech Stack

- **Next.js 14** - React framework met App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Database & Auth
- **Discord OAuth** - Authentication
- **Shadcn/ui** - UI componenten

## 🛠️ Setup Instructies

### 1. Installeer Dependencies

```bash
npm install
```

### 2. Setup Supabase

1. Maak een account aan op [supabase.com](https://supabase.com)
2. Maak een nieuw project
3. Ga naar Settings > API
4. Kopieer de URL en anon key

### 3. Setup Discord OAuth

1. Ga naar [Discord Developer Portal](https://discord.com/developers/applications)
2. Gebruik dezelfde applicatie als je bot
3. Ga naar OAuth2 > General
4. Voeg redirect URL toe: `http://localhost:3000/api/auth/callback`
5. Kopieer Client ID en Client Secret

### 4. Environment Variables

Maak een `.env.local` bestand:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Discord OAuth
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Discord Bot Integration
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_guild_id
```

### 5. Database Schema

Run deze SQL in Supabase SQL Editor:

```sql
-- Users table (linked to Discord)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  discord_tag TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table (synced with bot)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  discord_channel_id TEXT,
  status TEXT DEFAULT 'pending',
  service_type TEXT NOT NULL,
  service_details JSONB,
  price DECIMAL(10, 2),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tickets table
CREATE TABLE tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  discord_channel_id TEXT,
  subject TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES tickets(id),
  order_id UUID REFERENCES orders(id),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio table
CREATE TABLE portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  client TEXT,
  description TEXT,
  technologies TEXT[],
  features TEXT[],
  results TEXT,
  timeline TEXT,
  budget TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = discord_id);

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id IN (
    SELECT id FROM users WHERE discord_id = auth.uid()::text
  ));

CREATE POLICY "Public can view portfolio" ON portfolio
  FOR SELECT USING (true);

CREATE POLICY "Public can view reviews" ON reviews
  FOR SELECT USING (true);
```

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structuur

```
codecraft-webapp/
├── src/
│   ├── app/                    # App router pages
│   │   ├── (auth)/             # Auth groep
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/        # Dashboard groep
│   │   │   ├── dashboard/
│   │   │   ├── orders/
│   │   │   ├── tickets/
│   │   │   └── settings/
│   │   ├── admin/              # Admin panel
│   │   │   ├── orders/
│   │   │   ├── users/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── api/                # API routes
│   │   │   ├── auth/
│   │   │   ├── orders/
│   │   │   ├── tickets/
│   │   │   └── webhook/
│   │   ├── portfolio/
│   │   ├── pricing/
│   │   ├── contact/
│   │   └── page.tsx            # Homepage
│   ├── components/             # React componenten
│   │   ├── ui/                # UI componenten
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── ...
│   ├── lib/                    # Utilities
│   │   ├── supabase/
│   │   ├── discord/
│   │   └── utils.ts
│   └── types/                  # TypeScript types
└── public/                     # Static files
```

## 🔗 Bot Integratie

De webapp communiceert met de Discord bot via:
1. **Shared Supabase database** - Real-time sync
2. **Webhooks** - Event notifications
3. **Discord API** - Direct bot control

## 🚀 Deployment

### Vercel (Aanbevolen)
1. Push naar GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

### Railway/Render
Ook mogelijk met deze platforms.

## 📝 Todo

- [ ] Complete auth system
- [ ] Dashboard pagina's
- [ ] Admin panel
- [ ] Payment integratie
- [ ] Email notifications
- [ ] Real-time updates met Supabase
- [ ] Bot command sync

## 🤝 Support

Voor hulp, maak een issue aan op GitHub of join onze Discord server!
