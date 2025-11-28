-- Update game icons with better, more reliable URLs
UPDATE game_news_sources 
SET game_icon_url = CASE game_id
  -- League of Legends - Small official logo
  WHEN 'lol' THEN 'https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg'
  
  -- Valorant - Small official logo  
  WHEN 'valorant' THEN 'https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg'
  
  -- Fortnite - Small official logo
  WHEN 'fortnite' THEN 'https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg'
  
  -- Minecraft - Small official logo
  WHEN 'minecraft' THEN 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg'
  
  -- Counter-Strike 2 - Small official logo
  WHEN 'cs2' THEN 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg'
  
  ELSE game_icon_url
END
WHERE game_id IN ('lol', 'valorant', 'fortnite', 'minecraft', 'cs2');

