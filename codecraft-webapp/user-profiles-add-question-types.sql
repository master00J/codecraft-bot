-- Add question types support to user_profiles_forms
-- This allows questions to be: dropdown (select menu), text (text input), or number (number input)

-- Update questions JSONB structure to support type field
-- Existing questions will default to 'dropdown' type for backward compatibility

-- Example structure after update:
-- {
--   "id": "q1",
--   "text": "What's your name?",
--   "type": "text",  -- NEW: 'dropdown', 'text', or 'number'
--   "options": [],   -- Only required for dropdown type
--   "placeholder": "Enter your name",  -- Optional for text/number types
--   "minLength": 2,  -- Optional for text type
--   "maxLength": 50, -- Optional for text type
--   "min": 0,        -- Optional for number type
--   "max": 100,      -- Optional for number type
--   "required": true -- Optional, defaults to false
-- }

-- No schema changes needed - we're just updating the JSONB structure
-- The application code will handle the new format

-- Note: For backward compatibility, if type is not specified, it defaults to 'dropdown'

