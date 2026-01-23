-- Content Engine Schema

-- Content Items (raw input from various sources)
CREATE TABLE public.content_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('conversation', 'voice', 'video', 'session', 'text')),
  raw_content TEXT,
  transcript TEXT,
  extracted_insights JSONB DEFAULT '[]'::jsonb,
  topics TEXT[] DEFAULT '{}',
  content_type TEXT CHECK (content_type IN ('educational', 'controversial', 'personal_story', 'quick_tip', 'framework')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'approved', 'archived')),
  media_url TEXT,
  media_duration_seconds INTEGER,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Content Outputs (formatted for specific platforms)
CREATE TABLE public.content_outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram_reel', 'instagram_post', 'instagram_story', 'twitter', 'twitter_thread', 'youtube_short', 'facebook', 'knowledge_base', 'course_module', 'email', 'blog')),
  formatted_content TEXT NOT NULL,
  hook TEXT,
  cta TEXT,
  hashtags TEXT[],
  media_urls TEXT[],
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'posted', 'failed')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  posted_at TIMESTAMP WITH TIME ZONE,
  post_url TEXT,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content Topics (for categorization and tracking)
CREATE TABLE public.content_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  content_count INTEGER DEFAULT 0,
  last_posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default topics
INSERT INTO public.content_topics (name, display_name, description) VALUES
  ('motor_profile', 'Motor Profile', 'Spinner, Slingshotter, Whipper, Titan classifications'),
  ('transfer_ratio', 'Transfer Ratio', 'Energy transfer efficiency in the swing'),
  ('4b_framework', '4B Framework', 'Ball, Bat, Body, Brain analysis'),
  ('tempo', 'Tempo & Timing', 'Swing timing and rhythm'),
  ('data_critique', 'Data Critique', 'Challenging data-first approaches'),
  ('unlock_vs_add', 'Unlock vs Add', 'Philosophy of unlocking potential'),
  ('drills', 'Drills', 'Training exercises and techniques'),
  ('mindset', 'Mindset', 'Mental approach to hitting'),
  ('player_story', 'Player Story', 'Real examples and case studies'),
  ('biomechanics', 'Biomechanics', 'Movement science and mechanics');

-- Enable RLS
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_items (admin only)
CREATE POLICY "Admins can view all content items"
  ON public.content_items FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert content items"
  ON public.content_items FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update content items"
  ON public.content_items FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete content items"
  ON public.content_items FOR DELETE
  USING (public.is_admin());

-- RLS Policies for content_outputs
CREATE POLICY "Admins can view all content outputs"
  ON public.content_outputs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert content outputs"
  ON public.content_outputs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update content outputs"
  ON public.content_outputs FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete content outputs"
  ON public.content_outputs FOR DELETE
  USING (public.is_admin());

-- RLS Policies for content_topics (read-only for all, admin can modify)
CREATE POLICY "Anyone can view content topics"
  ON public.content_topics FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage content topics"
  ON public.content_topics FOR ALL
  USING (public.is_admin());

-- Trigger to update content_outputs.updated_at
CREATE TRIGGER update_content_outputs_updated_at
  BEFORE UPDATE ON public.content_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster queries
CREATE INDEX idx_content_items_status ON public.content_items(status);
CREATE INDEX idx_content_items_source_type ON public.content_items(source_type);
CREATE INDEX idx_content_items_topics ON public.content_items USING GIN(topics);
CREATE INDEX idx_content_outputs_status ON public.content_outputs(status);
CREATE INDEX idx_content_outputs_platform ON public.content_outputs(platform);
CREATE INDEX idx_content_outputs_scheduled_for ON public.content_outputs(scheduled_for);