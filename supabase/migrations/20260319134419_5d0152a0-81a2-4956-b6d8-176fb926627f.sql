ALTER TABLE public.player_sessions DROP CONSTRAINT player_sessions_rating_check;

ALTER TABLE public.player_sessions ADD CONSTRAINT player_sessions_rating_check 
  CHECK (rating = ANY (ARRAY['Elite'::text, 'Good'::text, 'Working'::text, 'Priority'::text, 'Excluded'::text]));