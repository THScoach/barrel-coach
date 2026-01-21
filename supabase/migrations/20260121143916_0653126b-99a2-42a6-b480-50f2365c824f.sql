-- Create table for final research briefs
CREATE TABLE public.final_research_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  raw_statcast_data JSONB,
  validated_data JSONB,
  data_status TEXT NOT NULL DEFAULT 'pending' CHECK (data_status IN ('pending', 'complete', 'incomplete', 'error')),
  missing_fields TEXT[],
  scouting_notes TEXT,
  powerpoint_slide_code TEXT,
  four_b_overlay JSONB DEFAULT '{}'::jsonb,
  private_notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.final_research_briefs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all research briefs"
  ON public.final_research_briefs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert research briefs"
  ON public.final_research_briefs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update research briefs"
  ON public.final_research_briefs FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete research briefs"
  ON public.final_research_briefs FOR DELETE
  USING (public.is_admin());

-- Index for faster lookups
CREATE INDEX idx_final_research_briefs_player ON public.final_research_briefs(player_name);
CREATE INDEX idx_final_research_briefs_status ON public.final_research_briefs(data_status);

-- Trigger for updated_at
CREATE TRIGGER update_final_research_briefs_updated_at
  BEFORE UPDATE ON public.final_research_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();