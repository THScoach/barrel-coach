
CREATE TABLE public.agent_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on agent_actions_log" ON public.agent_actions_log FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Service role full access on agent_actions_log" ON public.agent_actions_log FOR ALL TO service_role USING (true) WITH CHECK (true);
