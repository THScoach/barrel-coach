-- Fix the search_path for the new validation function
CREATE OR REPLACE FUNCTION validate_invite_delivery_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_method NOT IN ('sms', 'email', 'pending', 'failed') THEN
    RAISE EXCEPTION 'Invalid delivery_method: %. Must be sms, email, pending, or failed', NEW.delivery_method;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;