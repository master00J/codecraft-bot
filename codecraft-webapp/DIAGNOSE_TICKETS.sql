-- ================================================================
-- DIAGNOSE SCRIPT - Check wat er al bestaat
-- Run dit EERST om te zien wat er al in de database zit
-- ================================================================

-- Check of tickets tabel al bestaat
SELECT 
  'tickets tabel bestaat al' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tickets'
ORDER BY ordinal_position;

-- Check of ticket_config tabel al bestaat
SELECT 
  'ticket_config tabel bestaat al' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'ticket_config'
ORDER BY ordinal_position;

-- Check alle views die 'ticket' bevatten
SELECT 
  'Views met ticket' as info,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name LIKE '%ticket%';

-- Check alle policies op tickets
SELECT 
  'Policies op tickets' as info,
  policyname,
  tablename
FROM pg_policies
WHERE tablename LIKE '%ticket%';

-- Check alle functions die 'ticket' bevatten
SELECT 
  'Functions met ticket' as info,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%ticket%';

