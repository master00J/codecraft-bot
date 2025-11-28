-- Add customization columns to leveling_configs table
-- Run this migration to add support for custom XP bars, rank cards, and animations

-- XP Bar Customization
ALTER TABLE leveling_configs 
ADD COLUMN IF NOT EXISTS xp_bar_image_url TEXT,
ADD COLUMN IF NOT EXISTS xp_bar_color TEXT DEFAULT '#5865F2',
ADD COLUMN IF NOT EXISTS xp_bar_style TEXT DEFAULT 'gradient' CHECK (xp_bar_style IN ('gradient', 'solid', 'image')),
ADD COLUMN IF NOT EXISTS xp_bar_position TEXT DEFAULT 'bottom' CHECK (xp_bar_position IN ('top', 'center', 'bottom'));

-- Rank Card Customization
ALTER TABLE leveling_configs 
ADD COLUMN IF NOT EXISTS rank_card_background_url TEXT,
ADD COLUMN IF NOT EXISTS rank_card_border_color TEXT DEFAULT '#5865F2';

-- Level-up Animation
ALTER TABLE leveling_configs 
ADD COLUMN IF NOT EXISTS levelup_animation TEXT DEFAULT 'confetti' CHECK (levelup_animation IN ('none', 'confetti', 'fireworks', 'sparkles'));

-- Add comments for documentation
COMMENT ON COLUMN leveling_configs.xp_bar_image_url IS 'URL to custom XP bar image (recommended: 800x40px, transparent background)';
COMMENT ON COLUMN leveling_configs.xp_bar_color IS 'Hex color code for XP bar (used when style is gradient or solid)';
COMMENT ON COLUMN leveling_configs.xp_bar_style IS 'XP bar display style: gradient (default), solid, or image';
COMMENT ON COLUMN leveling_configs.xp_bar_position IS 'Position of XP bar on rank card: top, center, or bottom';
COMMENT ON COLUMN leveling_configs.rank_card_background_url IS 'URL to custom rank card background image (recommended: 1000x300px)';
COMMENT ON COLUMN leveling_configs.rank_card_border_color IS 'Hex color code for rank card border';
COMMENT ON COLUMN leveling_configs.levelup_animation IS 'Animation type when user levels up: none, confetti, fireworks, or sparkles';

