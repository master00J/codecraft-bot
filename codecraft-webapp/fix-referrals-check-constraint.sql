-- Fix referrals table check constraint to allow 'clicked' status
-- The existing constraint may not include 'clicked' as a valid status

-- Drop the existing check constraint
ALTER TABLE referrals 
  DROP CONSTRAINT IF EXISTS referrals_conversion_status_check;

-- Add new check constraint with all valid statuses
ALTER TABLE referrals 
  ADD CONSTRAINT referrals_conversion_status_check 
  CHECK (conversion_status IN ('clicked', 'signed_up', 'converted', 'expired'));

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Referrals check constraint updated - clicked status now allowed';
END $$;

