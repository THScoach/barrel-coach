-- Add delete policy for player_profiles (was missing)
CREATE POLICY "Admins can delete player profiles"
ON public.player_profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Add insert/update/delete policies for sms_logs (currently only has SELECT for admins)
CREATE POLICY "Admins can insert sms_logs"
ON public.sms_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update sms_logs"
ON public.sms_logs
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete sms_logs"
ON public.sms_logs
FOR DELETE
TO authenticated
USING (public.is_admin());