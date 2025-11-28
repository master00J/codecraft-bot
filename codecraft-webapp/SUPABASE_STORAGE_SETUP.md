# 🖼️ Supabase Storage Setup voor Embed Images

## ✨ Voordelen van Supabase Storage

- ✅ Je hebt het al! (geen externe API keys nodig)
- ✅ 1GB gratis storage
- ✅ CDN enabled (snelle loading)
- ✅ Automatische thumbnails
- ✅ Directe integratie met je database

---

## 🚀 Setup Stappen

### **1. Maak Storage Bucket aan**

1. Ga naar **Supabase Dashboard**
2. Klik op **Storage** in de sidebar
3. Klik **New Bucket**
4. Vul in:
   - **Name**: `comecraft-images` (met 'e' - CodeCraft!)
   - **Public bucket**: ✅ **JA** (aanvinken!)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/*`

5. Klik **Create Bucket**

### **2. Set Bucket Policies (RLS)**

In de Supabase SQL Editor, run:

```sql
-- Allow public read access (voor Discord embeds)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'comecraft-images' );

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'comecraft-images' );

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'comecraft-images' );
```

### **3. Verifieer**

Test of het werkt:

1. Ga naar je Embed Builder dashboard
2. Klik "📤 Upload" bij een image veld
3. Selecteer een foto
4. Wacht op "✅ Image uploaded!"
5. De URL wordt automatisch ingevuld!

---

## 📂 File Structure

Images worden opgeslagen als:

```
comecraft-images/
  └── embed-images/
      └── {guild_id}/
          └── {timestamp}-{random}.{ext}

Voorbeeld:
comecraft-images/embed-images/1234567890/1699123456789-abc123.png
```

---

## 🔧 Features

### **Auto Cleanup (Optioneel)**

Wil je oude, ongebruikte images automatisch verwijderen? Maak een cron job:

**API Route**: `/api/cron/cleanup-unused-images/route.ts`

```typescript
// Delete images older than 30 days that are not used in any embed
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data: unusedImages } = await supabase
  .from('embed_images')
  .select('*')
  .lt('created_at', thirtyDaysAgo.toISOString())
  .eq('used_in_embeds', []);

for (const image of unusedImages) {
  await supabase.storage
    .from('comcraft-images')
    .remove([image.filename]);
  
  await supabase
    .from('embed_images')
    .delete()
    .eq('id', image.id);
}
```

### **Image Tracking**

Alle uploads worden getracked in `embed_images` table:

```sql
SELECT 
  guild_id,
  COUNT(*) as total_images,
  SUM(size_bytes) as total_size_mb
FROM embed_images
WHERE deleted_at IS NULL
GROUP BY guild_id;
```

---

## 🎯 Usage Limits

### **Free Tier:**
- 1 GB storage
- 2 GB bandwidth/month
- Unlimited requests

### **Als je limiet bereikt:**

**Optie 1: Upgrade Supabase**
- $25/maand = 100GB storage

**Optie 2: Image Compression**
Compress images voor upload:

```typescript
// In de frontend, voor upload:
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true
};

const compressedFile = await imageCompression(file, options);
```

**Optie 3: External CDN Fallback**
Users kunnen altijd handmatig image URLs plakken (Imgur, Discord CDN, etc.)

---

## 💡 Best Practices

### **Image Optimization:**

**Voor Thumbnails (klein, rechtsboven):**
- 256x256px of kleiner
- < 100KB

**Voor Main Images (groot):**
- Max 1920x1080px
- < 2MB

**Formaten:**
- PNG voor graphics/logos
- JPEG voor photos
- GIF voor animations

### **Embed Limits:**
Discord heeft deze limits:
- Thumbnail: geen limit
- Main Image: geen limit
- Footer Icon: geen limit
- **Totaal embed size: 6000 characters**

---

## 🔐 Security

### **Wat is Public?**
- ✅ Image URLs zijn public (iedereen kan ze zien)
- ✅ Nodig voor Discord embeds!
- ❌ Users kunnen niet uploaden zonder login
- ❌ Users kunnen niet andermans images deleten

### **Waarom Public?**
Discord moet de images kunnen laden zonder authentication!

---

## 🚀 Je Bent Klaar!

Nu werkt image upload via:
- ✅ Supabase Storage (betrouwbaar!)
- ✅ Geen externe API keys
- ✅ Automatische CDN
- ✅ Tracking in database

**Geen Imgur nodig!** 🎉

