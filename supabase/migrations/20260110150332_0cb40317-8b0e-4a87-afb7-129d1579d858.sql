-- Fix function search_path mutable issue
-- Update update_player_profile_updated_at to set search_path
CREATE OR REPLACE FUNCTION public.update_player_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Add admin-specific RLS policies for sms_logs table for better granular access
-- This allows admins to view SMS logs directly without service role
CREATE POLICY "Admins can view sms_logs"
ON public.sms_logs
FOR SELECT
USING (public.is_admin());

-- Add admin policy to sms_scheduled for visibility
CREATE POLICY "Admins can view sms_scheduled"
ON public.sms_scheduled
FOR SELECT
USING (public.is_admin());

-- Add admin policy to sms_templates for visibility
CREATE POLICY "Admins can view sms_templates"
ON public.sms_templates
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can update sms_templates"
ON public.sms_templates
FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can insert sms_templates"
ON public.sms_templates
FOR INSERT
WITH CHECK (public.is_admin());