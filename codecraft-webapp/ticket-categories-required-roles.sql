-- Ticket categories: restrict who can open a ticket type (e.g. Premium tickets only for Premium role).
-- If required_role_ids is null or empty, everyone can open. If set, user must have at least one of these roles.
ALTER TABLE public.ticket_categories
  ADD COLUMN IF NOT EXISTS required_role_ids JSONB DEFAULT NULL;
COMMENT ON COLUMN public.ticket_categories.required_role_ids IS 'Discord role IDs. Only members with at least one of these roles can open this ticket type. Null/empty = everyone (e.g. Standard tickets).';
