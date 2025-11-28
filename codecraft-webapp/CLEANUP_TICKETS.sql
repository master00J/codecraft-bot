-- ================================================================
-- CLEANUP SCRIPT - Verwijder alles ticket-gerelateerd
-- RUN DIT ALLEEN ALS JE ALLES OPNIEUW WILT BEGINNEN
-- ================================================================

-- WAARSCHUWING: Dit verwijdert ALLE ticket data!
-- UNCOMMENT onderstaande regels ALLEEN als je zeker bent:

/*

-- Drop alle views
DROP VIEW IF EXISTS v_staff_performance CASCADE;
DROP VIEW IF EXISTS v_ticket_stats_30d CASCADE;
DROP VIEW IF EXISTS v_active_tickets CASCADE;

-- Drop alle triggers
DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON tickets CASCADE;
DROP TRIGGER IF EXISTS trigger_update_ticket_config_updated_at ON ticket_config CASCADE;
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets CASCADE;
DROP TRIGGER IF EXISTS update_ticket_config_updated_at ON ticket_config CASCADE;

-- Drop alle functions
DROP FUNCTION IF EXISTS update_tickets_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop alle tabellen
DROP TABLE IF EXISTS ticket_ratings CASCADE;
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS ticket_categories CASCADE;
DROP TABLE IF EXISTS ticket_config CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;

SELECT '🧹 Cleanup compleet! Je kunt nu het schema opnieuw installeren.' as status;

*/

