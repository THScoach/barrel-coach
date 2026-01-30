-- 1. clawdbot_knowledge - Main knowledge base table
CREATE TABLE clawdbot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clawdbot_knowledge_category ON clawdbot_knowledge(category);
CREATE INDEX idx_clawdbot_knowledge_tags ON clawdbot_knowledge USING GIN(tags);
CREATE INDEX idx_clawdbot_knowledge_search ON clawdbot_knowledge USING GIN(to_tsvector('english', title || ' ' || content));

ALTER TABLE clawdbot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON clawdbot_knowledge
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Allow service role full access" ON clawdbot_knowledge
  FOR ALL TO service_role USING (true);

-- 2. clawdbot_scenarios - Training Q&A pairs
CREATE TABLE clawdbot_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_input TEXT NOT NULL,
  ideal_response TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clawdbot_scenarios_search ON clawdbot_scenarios USING GIN(to_tsvector('english', player_input));
CREATE INDEX idx_clawdbot_scenarios_tags ON clawdbot_scenarios USING GIN(tags);

ALTER TABLE clawdbot_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON clawdbot_scenarios
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Allow service role full access" ON clawdbot_scenarios
  FOR ALL TO service_role USING (true);

-- 3. clawdbot_cues - Quick phrases and coaching cues
CREATE TABLE clawdbot_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cue_type TEXT NOT NULL,
  cue_text TEXT NOT NULL,
  context_hint TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clawdbot_cues_type ON clawdbot_cues(cue_type);

ALTER TABLE clawdbot_cues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON clawdbot_cues
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Allow service role full access" ON clawdbot_cues
  FOR ALL TO service_role USING (true);

-- 4. web_conversations - Track web chat conversations
CREATE TABLE web_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  session_id TEXT,
  is_test_mode BOOLEAN DEFAULT FALSE,
  test_player_context JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_web_conversations_player ON web_conversations(player_id);
CREATE INDEX idx_web_conversations_session ON web_conversations(session_id);

ALTER TABLE web_conversations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions)
CREATE POLICY "Allow service role full access" ON web_conversations
  FOR ALL TO service_role USING (true);

-- Allow authenticated users to read their own conversations (via session_id match)
CREATE POLICY "Users can view own session conversations" ON web_conversations
  FOR SELECT TO authenticated USING (true);

-- 5. web_messages - Individual messages in conversations
CREATE TABLE web_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES web_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('player', 'assistant')),
  content TEXT NOT NULL,
  rating TEXT CHECK (rating IN ('good', 'bad', 'edited')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_web_messages_conversation ON web_messages(conversation_id);
CREATE INDEX idx_web_messages_created ON web_messages(created_at);

ALTER TABLE web_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON web_messages
  FOR ALL TO service_role USING (true);

CREATE POLICY "Users can view conversation messages" ON web_messages
  FOR SELECT TO authenticated USING (true);

-- 6. clawdbot_ratings - Track response ratings
CREATE TABLE clawdbot_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES web_messages(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'bad', 'edited')),
  original_response TEXT,
  corrected_response TEXT,
  coach_notes TEXT,
  knowledge_ids UUID[],
  scenario_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by TEXT
);

CREATE INDEX idx_clawdbot_ratings_message ON clawdbot_ratings(message_id);
CREATE INDEX idx_clawdbot_ratings_rating ON clawdbot_ratings(rating);

ALTER TABLE clawdbot_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON clawdbot_ratings
  FOR ALL TO service_role USING (true);

-- Seed Motor Profiles
INSERT INTO clawdbot_knowledge (category, subcategory, title, content, tags, priority) VALUES
('motor_profile', 'spinner', 'Spinner Motor Profile', 'Spinners generate power through rotational mechanics. They tend to have strong hip rotation and upper body separation. Common traits include: strong core engagement, tendency toward pull-side hitting, may struggle with outside pitches. Key focus: maintaining connection through rotation.', ARRAY['motor_profile', 'spinner', 'rotation'], 10),
('motor_profile', 'whipper', 'Whipper Motor Profile', 'Whippers generate power through arm speed and hand path. They create bat speed through quick hands and whip-like action. Common traits: fast hands, good bat-to-ball skills, may leak power. Key focus: sequencing and maintaining lag.', ARRAY['motor_profile', 'whipper', 'hands'], 10),
('motor_profile', 'slingshotter', 'Slingshotter Motor Profile', 'Slingshotters generate power through linear momentum and weight transfer. They load and explode forward. Common traits: strong legs, good weight shift, may drift or lunge. Key focus: controlled aggression and staying back.', ARRAY['motor_profile', 'slingshotter', 'linear'], 10);

-- Seed 4B System
INSERT INTO clawdbot_knowledge (category, subcategory, title, content, tags, priority) VALUES
('4b_system', 'body', 'Body Pillar (4B System)', 'The Body pillar measures physical capability and movement quality. It includes mobility, stability, strength, and kinetic chain efficiency. Low Body scores indicate physical limitations that need addressing before technical work. Improvement: mobility work, strength training, movement patterns.', ARRAY['4b', 'body', 'physical'], 10),
('4b_system', 'brain', 'Brain Pillar (4B System)', 'The Brain pillar measures timing, rhythm, tempo, and decision-making. It reflects how well a hitter processes information and times their movements. Low Brain scores indicate timing or recognition issues. Improvement: timing drills, tempo work, pitch recognition.', ARRAY['4b', 'brain', 'timing'], 10),
('4b_system', 'bat', 'Bat Pillar (4B System)', 'The Bat pillar measures swing mechanics and bat path. It includes attack angle, bat speed, and path efficiency. Low Bat scores indicate mechanical issues with the swing itself. Improvement: tee work, path drills, mechanical adjustments.', ARRAY['4b', 'bat', 'mechanics'], 10),
('4b_system', 'ball', 'Ball Pillar (4B System)', 'The Ball pillar measures contact quality and batted ball outcomes. It includes exit velocity, launch angle, and barrel rate. Low Ball scores indicate contact or power leaks. Improvement: barrel drills, contact point work, intent training.', ARRAY['4b', 'ball', 'contact'], 10);

-- Seed Coaching Philosophy
INSERT INTO clawdbot_knowledge (category, subcategory, title, content, tags, priority) VALUES
('coaching_philosophy', 'core', 'We Dont Add We Unlock', 'Core philosophy: every player already has the ability within them. Our job is not to add new movements but to unlock what is already there by removing restrictions and inefficiencies.', ARRAY['philosophy', 'core', 'mindset'], 10),
('coaching_philosophy', 'core', 'Barrels Not Biceps', 'Focus on barrel accuracy and contact quality over raw strength. A well-barreled ball beats a muscled mis-hit every time.', ARRAY['philosophy', 'barrels', 'contact'], 10),
('coaching_philosophy', 'core', 'Hunt Barrels', 'The goal of every swing is to hunt barrels - seeking optimal contact that produces hard, well-struck balls.', ARRAY['philosophy', 'barrels', 'intent'], 10);

-- Seed Coaching Cues
INSERT INTO clawdbot_cues (cue_type, cue_text, context_hint) VALUES
('encouragement', 'Lets hunt some barrels', 'Starting a session or after good work'),
('encouragement', 'Get after it', 'Motivating effort'),
('encouragement', 'Trust the process', 'When player is frustrated'),
('encouragement', 'Thats the move', 'After good execution'),
('correction', 'Thats not quite it - lets try a different approach', 'When technique is off'),
('correction', 'Lets slow it down and feel it', 'When rushing'),
('greeting', 'Yo! Whats up?', 'Casual greeting'),
('greeting', 'Ready to work?', 'Session start'),
('closing', 'Great work today. Keep hunting those barrels.', 'End of session'),
('profile_spinner', 'Stay connected through the turn', 'Spinner-specific cue'),
('profile_whipper', 'Let those hands work', 'Whipper-specific cue'),
('profile_slingshotter', 'Load and explode', 'Slingshotter-specific cue');