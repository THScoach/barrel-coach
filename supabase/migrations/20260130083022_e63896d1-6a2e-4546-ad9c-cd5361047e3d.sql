-- Add missing columns to web_conversations if they don't exist
ALTER TABLE public.web_conversations 
ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS test_player_context JSONB,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clawdbot_knowledge_category ON public.clawdbot_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_clawdbot_knowledge_subcategory ON public.clawdbot_knowledge(subcategory);
CREATE INDEX IF NOT EXISTS idx_clawdbot_knowledge_active ON public.clawdbot_knowledge(is_active);
CREATE INDEX IF NOT EXISTS idx_clawdbot_scenarios_category ON public.clawdbot_scenarios(category);
CREATE INDEX IF NOT EXISTS idx_clawdbot_scenarios_active ON public.clawdbot_scenarios(is_active);
CREATE INDEX IF NOT EXISTS idx_clawdbot_cues_type ON public.clawdbot_cues(cue_type);
CREATE INDEX IF NOT EXISTS idx_clawdbot_cues_active ON public.clawdbot_cues(is_active);
CREATE INDEX IF NOT EXISTS idx_web_conversations_player ON public.web_conversations(player_id);
CREATE INDEX IF NOT EXISTS idx_web_conversations_active ON public.web_conversations(is_active);
CREATE INDEX IF NOT EXISTS idx_web_messages_conversation ON public.web_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_clawdbot_ratings_message ON public.clawdbot_ratings(message_id);

-- Seed Motor Profile knowledge
INSERT INTO public.clawdbot_knowledge (category, subcategory, title, content, tags, priority, is_active)
VALUES 
  ('motor_profile', 'spinner', 'Spinner Motor Profile', 
   'Spinners are rotational hitters who generate power through hip and torso rotation. They naturally turn their body like a door on a hinge. Key characteristics: early hip rotation, connected swing, power comes from the core. Common issues: getting disconnected, casting hands. Best drills: Connection Drill, Hip Hinge Drill, Pivot Drill.', 
   ARRAY['spinner', 'motor profile', 'rotation', 'hip turn'], 10, true),
  
  ('motor_profile', 'whipper', 'Whipper Motor Profile',
   'Whippers generate power through hand speed and arm action. They whip the bat through the zone with quick hands. Key characteristics: fast hands, late acceleration, explosive finish. Common issues: rolling over, losing barrel. Best drills: Bat Path Drill, Whip Drill, Hand Speed Drill.',
   ARRAY['whipper', 'motor profile', 'hand speed', 'arm action'], 10, true),
  
  ('motor_profile', 'slingshotter', 'Slingshotter Motor Profile',
   'Slingshotters load and explode, using a powerful push-pull action. They store energy in their load and release it explosively. Key characteristics: deep load, explosive push, linear-rotational hybrid. Common issues: over-loading, timing issues. Best drills: Load Drill, Push-Pull Drill, Timing Drill.',
   ARRAY['slingshotter', 'motor profile', 'load', 'explosion'], 10, true)
ON CONFLICT DO NOTHING;

-- Seed 4B System knowledge
INSERT INTO public.clawdbot_knowledge (category, subcategory, title, content, tags, priority, is_active)
VALUES 
  ('4b_system', 'body', 'Body - The 4B System',
   'Body is the foundation of the swing. It includes posture, balance, and movement patterns. A strong Body score means efficient movement and athletic positions. Low Body scores often indicate balance issues, poor posture, or inefficient movement patterns. Focus on athletic stance, weight transfer, and ground force.',
   ARRAY['body', '4b', 'posture', 'balance', 'movement'], 10, true),
  
  ('4b_system', 'brain', 'Brain - The 4B System',
   'Brain represents timing, tempo, and decision-making. A high Brain score means consistent timing and good pitch recognition. Low Brain scores indicate timing issues, rushing, or tempo problems. Focus on rhythm, timing mechanisms, and mental approach to each swing.',
   ARRAY['brain', '4b', 'timing', 'tempo', 'rhythm'], 10, true),
  
  ('4b_system', 'bat', 'Bat - The 4B System',
   'Bat measures the path of the bat through the zone. It includes attack angle, barrel control, and swing plane. High Bat scores mean efficient barrel delivery. Low Bat scores indicate bat path issues, casting, or swing plane problems. Focus on staying connected and letting the barrel work.',
   ARRAY['bat', '4b', 'bat path', 'attack angle', 'barrel'], 10, true),
  
  ('4b_system', 'ball', 'Ball - The 4B System',
   'Ball measures contact quality and ball flight. It includes exit velocity, launch angle, and spray patterns. High Ball scores mean consistent hard contact. Low Ball scores indicate contact issues or mishits. Focus on hitting the ball on the sweet spot consistently.',
   ARRAY['ball', '4b', 'contact', 'exit velocity', 'launch angle'], 10, true)
ON CONFLICT DO NOTHING;

-- Seed Coaching Philosophy knowledge
INSERT INTO public.clawdbot_knowledge (category, subcategory, title, content, tags, priority, is_active)
VALUES 
  ('coaching_philosophy', NULL, 'We Don''t Add, We Unlock',
   'Every player already has the ability inside them. Our job as coaches is not to add new mechanics but to remove the restrictions holding them back. We unlock natural movement patterns by eliminating tension, fear, and bad habits. Trust the athlete inside.',
   ARRAY['philosophy', 'unlock', 'natural', 'ability'], 10, true),
  
  ('coaching_philosophy', NULL, 'Barrels Not Biceps',
   'Power comes from efficient movement, not raw strength. Focus on barrel quality over bat speed alone. A well-barreled ball at 85 mph will outperform a mishit at 95 mph. Hunt the sweet spot, not the gym.',
   ARRAY['philosophy', 'barrels', 'contact', 'efficiency'], 10, true),
  
  ('coaching_philosophy', NULL, 'Hunt Barrels',
   'Every swing should have intent to find the barrel. We''re not just swinging - we''re hunting. Hunting means preparation, focus, and execution. Go into every at-bat looking to barrel the ball, not just make contact.',
   ARRAY['philosophy', 'hunt', 'intent', 'barrels'], 10, true)
ON CONFLICT DO NOTHING;

-- Seed Coaching Cues
INSERT INTO public.clawdbot_cues (cue_type, cue_text, context_hint, is_active, use_count)
VALUES 
  -- Greetings
  ('greeting', 'Yo! What''s up?', 'Casual opener', true, 0),
  ('greeting', 'Ready to work?', 'When player seems motivated', true, 0),
  ('greeting', 'Let''s get after it!', 'Energetic opener', true, 0),
  
  -- Encouragement
  ('encouragement', 'Let''s hunt some barrels!', 'Before a session or drill', true, 0),
  ('encouragement', 'That''s the move!', 'After good feedback or progress', true, 0),
  ('encouragement', 'Trust the process.', 'When player is frustrated', true, 0),
  ('encouragement', 'You got this.', 'Confidence boost', true, 0),
  
  -- Corrections
  ('correction', 'Not quite - let''s try again.', 'After a miss or bad rep', true, 0),
  ('correction', 'Slow it down.', 'When rushing', true, 0),
  
  -- Profile-specific
  ('profile_spinner', 'Stay connected through the turn.', 'For spinners getting disconnected', true, 0),
  ('profile_whipper', 'Let those hands work.', 'For whippers being too mechanical', true, 0),
  ('profile_slingshotter', 'Load and explode.', 'For slingshotters not loading enough', true, 0)
ON CONFLICT DO NOTHING;

-- Seed initial scenarios
INSERT INTO public.clawdbot_scenarios (player_input, ideal_response, category, tags, is_active, use_count)
VALUES 
  ('My swing feels slow', 'Let''s check your tempo. What''s your Brain score showing? That usually tells us if it''s a timing thing or a mechanical thing.', 'diagnostic', ARRAY['timing', 'brain', 'tempo'], true, 0),
  ('I keep popping up', 'That''s a bat path issue. What''s your Bat score? We probably need to work on attack angle. Try the Bat Path Drill.', 'technical', ARRAY['bat', 'mechanics', 'pop-ups'], true, 0),
  ('What drills should I do?', 'Depends on your priority. What''s your lowest 4B score right now? That tells us where to focus.', 'drill_recommendation', ARRAY['drills', 'prescription'], true, 0),
  ('Hey', 'Yo! What''s up? Ready to hunt some barrels today?', 'greeting', ARRAY['greeting', 'casual'], true, 0),
  ('I''m struggling', 'We''ve all been there. Tell me what''s going on - is it practice or games? Let''s figure this out.', 'motivational', ARRAY['struggle', 'support', 'motivation'], true, 0)
ON CONFLICT DO NOTHING;