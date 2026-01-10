-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only service role can manage user_roles (prevent privilege escalation)
CREATE POLICY "Service role can manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Create security definer function to check roles (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Fix swing-videos storage: Replace public policy with owner-based access
DROP POLICY IF EXISTS "Anyone can read swing videos" ON storage.objects;

-- Create policy for session owners to access their videos
CREATE POLICY "Session owners can read swing videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'swing-videos' AND (
    -- Service role always has access
    auth.role() = 'service_role' OR
    -- Check if user owns the session (path format: session_id/filename)
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id::text = split_part(name, '/', 1)
        AND sessions.user_id = auth.uid()
    )
  )
);

-- Allow authenticated users to upload to their sessions
CREATE POLICY "Users can upload to own session"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'swing-videos' AND (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id::text = split_part(name, '/', 1)
        AND sessions.user_id = auth.uid()
    )
  )
);

-- Fix swings table RLS to only allow session owners
DROP POLICY IF EXISTS "Anyone can read swings" ON public.swings;
DROP POLICY IF EXISTS "Public read access to swings" ON public.swings;

CREATE POLICY "Session owners can read swings"
ON public.swings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = swings.session_id
      AND (sessions.user_id = auth.uid() OR auth.role() = 'service_role')
  )
);