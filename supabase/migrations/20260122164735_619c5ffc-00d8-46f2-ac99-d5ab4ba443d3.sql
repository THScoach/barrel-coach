-- Clean up GHL-specific data from ghl_webhook_logs
-- Keep the table structure but repurpose it as communication_logs for general logging

-- First, rename the table to be more generic
ALTER TABLE IF EXISTS ghl_webhook_logs RENAME TO communication_logs;

-- Add a comment to clarify the table's new purpose
COMMENT ON TABLE communication_logs IS 'Logs for all outbound communications (SMS, Email, webhooks)';

-- Update the invites table to remove GHL-specific delivery_method values
-- Update any 'ghl' delivery_method to 'sms' or 'email' based on contact info
UPDATE invites 
SET delivery_method = CASE 
  WHEN phone IS NOT NULL THEN 'sms'
  WHEN email IS NOT NULL THEN 'email'
  ELSE 'pending'
END
WHERE delivery_method = 'ghl';

-- Add a check constraint to prevent 'ghl' as a delivery method going forward
-- First drop any existing constraint
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_delivery_method_check;

-- Create a validation trigger instead of CHECK constraint for better flexibility
CREATE OR REPLACE FUNCTION validate_invite_delivery_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_method NOT IN ('sms', 'email', 'pending', 'failed') THEN
    RAISE EXCEPTION 'Invalid delivery_method: %. Must be sms, email, pending, or failed', NEW.delivery_method;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invite_delivery_method_trigger ON invites;
CREATE TRIGGER validate_invite_delivery_method_trigger
  BEFORE INSERT OR UPDATE ON invites
  FOR EACH ROW
  EXECUTE FUNCTION validate_invite_delivery_method();