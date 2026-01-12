-- Add phone number and delivery method to invites table
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'sms', 'both'));