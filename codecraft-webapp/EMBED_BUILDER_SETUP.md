# 📝 ComCraft Visual Embed Builder - Setup Guide

## 🎨 Wat Is Het?

Een volledige visual embed builder waarmee je prachtige Discord embeds kunt maken, opslaan, en automatisch posten. Perfect voor:
- Server rules
- Announcements
- Stream alerts
- Event posts
- Welcome messages

---

## ✨ Features

### **1. Visual Builder**
- ✅ Live preview terwijl je bouwt
- ✅ Custom colors, titles, descriptions
- ✅ Thumbnail & large images
- ✅ Author met icon
- ✅ Footer met icon
- ✅ Timestamp toggle
- ✅ Unlimited custom fields
- ✅ Inline fields support

### **2. Image Uploads**
- ✅ Upload naar Imgur (gratis CDN)
- ✅ Thumbnail (klein, rechtsboven)
- ✅ Main image (groot, onder embed)
- ✅ Footer icon
- ✅ Author icon

### **3. Templates**
- ✅ Server Rules template
- ✅ Stream Announcement template
- ✅ Welcome Message template
- ✅ Event Announcement template
- ✅ Custom templates

### **4. Save & Reuse**
- ✅ Opslaan voor later
- ✅ Edit bestaande embeds
- ✅ Usage tracking
- ✅ Tags & categorization

### **5. Post to Discord**
- ✅ Selecteer channel
- ✅ @role mention optioneel
- ✅ Auto-pin optie
- ✅ Direct naar Discord via bot

### **6. Scheduling (Database Ready!)**
- ⏳ Eenmalig (once)
- ⏳ Dagelijks (daily)
- ⏳ Wekelijks (weekly)
- ⏳ Maandelijks (monthly)

**Note:** Scheduling is database-ready maar de cron job is nog niet geïmplementeerd!

---

## 🚀 Setup Stappen

### **1. Run SQL Schema**

Open **Supabase SQL Editor** en run:

```sql
-- codecraft-webapp/EMBED_BUILDER_SCHEMA.sql
```

Dit maakt de volgende tables:
- `saved_embeds` - Opgeslagen embeds
- `scheduled_embeds` - Geplande posts
- `embed_images` - Uploaded images tracking
- `embed_templates` - Template library

### **2. Supabase Storage Setup (Voor Image Upload)**

1. Ga naar **Supabase Dashboard** → **Storage**
2. Klik **New Bucket**
3. Vul in:
   - Name: `comecraft-images` (met 'e' - CodeCraft!)
   - Public: ✅ **JA**
   - File size limit: 10 MB
   - Allowed MIME types: `image/*`
4. Klik **Create Bucket**

**Run in Supabase SQL Editor:**
```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'comecraft-images' );

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'comecraft-images' );
```

**✅ GEEN EXTRA API KEYS NODIG!** Je Supabase credentials zijn genoeg.

**Zie ook:** `SUPABASE_STORAGE_SETUP.md` voor volledige details.

### **3. Bot Update**

Upload naar Apollo (ComCraft server):
- `bot-comcraft.js` (UPDATED - heeft `/api/embeds/post` endpoint!)

Restart bot en check logs:
```
📝 Posted embed to [Guild]/#[channel]  ← MOET JE ZIEN!
```

### **4. Deploy!**

Push naar GitHub en Vercel deployed automatisch! ✅

---

## 🎯 Hoe Te Gebruiken

### **A. Nieuwe Embed Maken**

1. Ga naar **ComCraft Dashboard** → Select server → **📝 Embed Builder**
2. Klik **➕ Nieuwe Embed Maken**
3. Vul in:
   - **Embed Naam** (intern, bijv. "Server Rules")
   - **Title** (bijv. "📜 Server Rules")
   - **Description** (de main text)
   - **Color** (hex color picker!)
   
4. **Images uploaden:**
   - Klik **📤 Upload** bij Thumbnail of Image
   - Selecteer je foto
   - URL wordt automatisch ingevuld!

5. **Fields toevoegen:**
   - Klik **+ Veld Toevoegen**
   - Naam: "Rule 1"
   - Waarde: "Be respectful..."
   - Toggle "Inline" voor side-by-side fields

6. **Live Preview:**
   - Zie je embed real-time aan de rechterkant!
   - Exact hoe het eruit ziet in Discord!

7. Klik **💾 Opslaan**

### **B. Template Gebruiken**

In de builder, rechterkant:
- Klik op een template (Rules, Announcement, etc.)
- Template wordt geladen in de builder
- Pas aan en save!

### **C. Post naar Discord**

1. In de **Saved Embeds** tab
2. Find je embed
3. Klik **📤 Post**
4. Selecteer:
   - Channel (bijv. #announcements)
   - Optional: @role mention
   - Optional: Pin message
5. Klik **📤 Post Nu**

Embed wordt instant in Discord gepost!

### **D. Edit Bestaande Embed**

1. In de **Saved Embeds** tab
2. Klik **✏️ Edit** op je embed
3. Maak wijzigingen
4. Klik **💾 Opslaan**

---

## 🎨 Advanced Tips

### **Image Best Practices:**
- **Thumbnail:** 256x256px of smaller (logo, icon)
- **Main Image:** 800-1200px wide (banner, artwork)
- **Footer/Author Icon:** 128x128px (small icon)
- **Formaat:** PNG of JPG
- **Max size:** 10MB per image

### **Color Schemes:**
```
Discord Blurple: #5865F2
Success Green:   #57F287
Warning Yellow:  #FEE75C
Error Red:       #ED4245
Stream Purple:   #9146FF
```

### **Field Usage:**
- **Inline = false:** Full width (voor lange text)
- **Inline = true:** Side by side (voor stats, lists)
- Max 25 fields per embed

### **When to Use Embeds:**
✅ **YES:**
- Rules & info
- Announcements
- Event posts
- Leaderboards
- Stream going live alerts
- Welcome messages

❌ **NO:**
- Normal conversation
- Quick updates (just use regular messages)
- Spam (don't overuse!)

---

## 🔧 Troubleshooting

### **"Upload failed"**
- Check of `comecraft-images` bucket bestaat in Supabase Storage
- Check of bucket **Public** is
- Check of RLS policies correct zijn
- Image moet < 10MB zijn
- Moet een image zijn (jpg/png/gif/webp)

### **"Channel not found"**
- Bot moet in de server zitten
- Channel moet text channel zijn
- Bot moet Send Messages permission hebben

### **"Failed to pin"**
- Bot moet Manage Messages permission hebben

### **Preview ziet er anders uit dan in Discord**
- Preview is een simulatie
- Discord kan slight formatting differences hebben
- Test altijd in Discord!

---

## 📊 Database Structure

### **saved_embeds**
```
- id, guild_id, created_by
- name, template_type, tags
- title, description, color, url
- thumbnail_url, image_url
- footer_text, footer_icon_url
- author_name, author_icon_url, author_url
- show_timestamp
- fields (JSONB array)
- times_used, last_used_at
```

### **scheduled_embeds**
```
- id, guild_id, embed_id
- channel_id
- schedule_type (once, daily, weekly, monthly)
- scheduled_for, time_of_day, day_of_week, day_of_month
- next_send_at (auto-calculated!)
- status (pending, sent, failed, cancelled)
- mention_role_id, pin_message
```

### **embed_templates**
```
- id, name, description, category
- title, description, color, fields
- is_premium, times_used
```

---

## 🚀 Next Steps (Scheduling Cron Job)

Om scheduling te activeren, maak een Vercel cron job:

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled-embeds",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**API Route:** `/api/cron/send-scheduled-embeds/route.ts`
- Fetch alle `status='pending'` waar `next_send_at <= NOW()`
- Post embed via bot API
- Update `status='sent'`, `last_sent_at`
- Recalculate `next_send_at` voor recurring

---

## 🎉 Je Hebt Nu:

- ✅ Visual embed builder met live preview
- ✅ Image uploads (Imgur)
- ✅ Template library
- ✅ Save & reuse system
- ✅ Direct post to Discord
- ✅ Database-ready scheduling (alleen cron job mist!)

**Dit is een PREMIUM feature die MEE6 NIET heeft in hun free plan!** 🔥

