/**
 * Capsules Schema Migration
 * Extends saved_embeds table to support capsules (multiple embeds + components)
 */

-- Add capsule support columns to saved_embeds
ALTER TABLE saved_embeds 
ADD COLUMN IF NOT EXISTS is_capsule BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS capsule_type TEXT, -- announcement, showcase, leaderboard, form, custom
ADD COLUMN IF NOT EXISTS embeds JSONB DEFAULT '[]'::jsonb, -- Array of embed objects for capsules
ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb, -- Array of component rows (buttons/select menus)
ADD COLUMN IF NOT EXISTS content TEXT; -- Message content (text above embeds)

-- Update existing embeds to be compatible
-- Convert single embed to capsule format for backward compatibility
UPDATE saved_embeds 
SET 
  is_capsule = false,
  embeds = jsonb_build_array(
    jsonb_build_object(
      'title', title,
      'description', description,
      'color', color,
      'url', url,
      'thumbnail', CASE WHEN thumbnail_url IS NOT NULL THEN jsonb_build_object('url', thumbnail_url) ELSE NULL END,
      'image', CASE WHEN image_url IS NOT NULL THEN jsonb_build_object('url', image_url) ELSE NULL END,
      'footer', CASE WHEN footer_text IS NOT NULL THEN 
        jsonb_build_object('text', footer_text, 'icon_url', footer_icon_url) 
      ELSE NULL END,
      'author', CASE WHEN author_name IS NOT NULL THEN 
        jsonb_build_object('name', author_name, 'icon_url', author_icon_url, 'url', author_url) 
      ELSE NULL END,
      'fields', COALESCE(fields, '[]'::jsonb),
      'timestamp', CASE WHEN show_timestamp THEN NOW()::text ELSE NULL END
    )
  )
WHERE embeds = '[]'::jsonb OR embeds IS NULL;

-- Add index for capsule queries
CREATE INDEX IF NOT EXISTS idx_saved_embeds_capsule ON saved_embeds(guild_id, is_capsule) WHERE is_capsule = true;
CREATE INDEX IF NOT EXISTS idx_saved_embeds_capsule_type ON saved_embeds(guild_id, capsule_type) WHERE is_capsule = true;

-- Add comment for documentation
COMMENT ON COLUMN saved_embeds.is_capsule IS 'True if this is a capsule (multiple embeds + components), false for single embed';
COMMENT ON COLUMN saved_embeds.capsule_type IS 'Template type: announcement, showcase, leaderboard, form, custom';
COMMENT ON COLUMN saved_embeds.embeds IS 'Array of embed objects (for capsules, max 10)';
COMMENT ON COLUMN saved_embeds.components IS 'Array of component rows (buttons/select menus, max 5 rows)';
COMMENT ON COLUMN saved_embeds.content IS 'Message content text (appears above embeds)';

SELECT '✅ Capsules schema migration completed!' as status;

