
UPDATE public.players p
SET 
  height_inches = CASE 
    WHEN REPLACE(pp.height, '"', '') ~ $$^\d+'\d+$$
    THEN (SPLIT_PART(REPLACE(pp.height, '"', ''), '''', 1)::numeric * 12) + SPLIT_PART(REPLACE(pp.height, '"', ''), '''', 2)::numeric
    WHEN REPLACE(pp.height, '"', '') ~ '^\d+$'
    THEN REPLACE(pp.height, '"', '')::numeric
    ELSE p.height_inches
  END,
  weight_lbs = COALESCE(p.weight_lbs, pp.weight::numeric),
  handedness = COALESCE(p.handedness, 
    CASE 
      WHEN LOWER(pp.bats) IN ('l', 'left') THEN 'left'
      WHEN LOWER(pp.bats) IN ('r', 'right') THEN 'right'
      WHEN LOWER(pp.bats) IN ('s', 'switch', 'b', 'both') THEN 'switch'
      ELSE p.handedness
    END
  ),
  updated_at = NOW()
FROM public.player_profiles pp
WHERE pp.players_id = p.id
  AND (p.height_inches IS NULL OR p.weight_lbs IS NULL OR p.handedness IS NULL)
  AND (pp.height IS NOT NULL OR pp.weight IS NOT NULL OR pp.bats IS NOT NULL);
