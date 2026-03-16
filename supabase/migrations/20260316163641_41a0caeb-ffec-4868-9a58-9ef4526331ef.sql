ALTER TABLE public.players ADD COLUMN IF NOT EXISTS throws text;

ALTER TABLE public.players ADD CONSTRAINT players_throws_check CHECK (throws = ANY (ARRAY['left'::text, 'right'::text, 'switch'::text]));