-- Create the backfill function that creates players rows for unlinked profiles
CREATE OR REPLACE FUNCTION public.backfill_players_from_profiles(limit_count integer DEFAULT 200)
RETURNS TABLE (
  profile_id uuid,
  created_player_id uuid,
  player_name text,
  linked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  new_player_id uuid;
  full_name text;
  mapped_handedness text;
  mapped_level text;
BEGIN
  FOR r IN
    SELECT *
    FROM public.player_profiles
    WHERE players_id IS NULL
    ORDER BY created_at ASC
    LIMIT limit_count
  LOOP
    full_name := TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, ''));
    
    -- Map bats to handedness constraint values
    mapped_handedness := CASE 
      WHEN LOWER(r.bats) IN ('l', 'left') THEN 'left'
      WHEN LOWER(r.bats) IN ('r', 'right') THEN 'right'
      WHEN LOWER(r.bats) IN ('s', 'switch', 'b', 'both') THEN 'switch'
      ELSE NULL
    END;
    
    -- Map level to constraint values
    mapped_level := CASE 
      WHEN LOWER(r.level) IN ('youth', 'little league', 'travel') THEN 'youth'
      WHEN LOWER(r.level) IN ('high_school', 'high school', 'hs', 'varsity', 'jv') THEN 'high_school'
      WHEN LOWER(r.level) IN ('college', 'juco', 'd1', 'd2', 'd3', 'naia') THEN 'college'
      WHEN LOWER(r.level) IN ('pro', 'professional', 'milb', 'minor league', 'minors', 'indy', 'independent') THEN 'pro'
      WHEN LOWER(r.level) IN ('mlb', 'major league', 'majors') THEN 'mlb'
      ELSE NULL
    END;

    INSERT INTO public.players (
      name,
      email,
      phone,
      age,
      level,
      team,
      position,
      handedness,
      height_inches,
      weight_lbs,
      mlb_id,
      fangraphs_id,
      bbref_id,
      account_status,
      can_login,
      is_public,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      NULLIF(full_name, ''),
      r.email,
      r.phone,
      r.age,
      mapped_level,
      r.current_team,
      r.position,
      mapped_handedness,
      NULL, -- height stored as text in profiles
      CASE WHEN r.weight IS NULL THEN NULL ELSE r.weight::numeric END,
      r.mlb_id,
      r.fangraphs_id,
      r.baseball_reference_id,
      'active',
      FALSE,
      FALSE,
      'Auto-created from player_profiles backfill',
      NOW(),
      NOW()
    )
    RETURNING id INTO new_player_id;

    UPDATE public.player_profiles
      SET players_id = new_player_id,
          updated_at = NOW()
      WHERE id = r.id;

    profile_id := r.id;
    created_player_id := new_player_id;
    player_name := full_name;
    linked := TRUE;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Create a single-profile linking function for real-time use in upload modals
CREATE OR REPLACE FUNCTION public.ensure_player_linked(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_players_id uuid;
  v_profile record;
  mapped_handedness text;
  mapped_level text;
  full_name text;
BEGIN
  -- Check if already linked
  SELECT players_id INTO v_players_id
  FROM public.player_profiles
  WHERE id = p_profile_id;
  
  IF v_players_id IS NOT NULL THEN
    RETURN v_players_id;
  END IF;
  
  -- Get profile data
  SELECT * INTO v_profile
  FROM public.player_profiles
  WHERE id = p_profile_id;
  
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found: %', p_profile_id;
  END IF;
  
  full_name := TRIM(COALESCE(v_profile.first_name, '') || ' ' || COALESCE(v_profile.last_name, ''));
  
  -- Map values
  mapped_handedness := CASE 
    WHEN LOWER(v_profile.bats) IN ('l', 'left') THEN 'left'
    WHEN LOWER(v_profile.bats) IN ('r', 'right') THEN 'right'
    WHEN LOWER(v_profile.bats) IN ('s', 'switch', 'b', 'both') THEN 'switch'
    ELSE NULL
  END;
  
  mapped_level := CASE 
    WHEN LOWER(v_profile.level) IN ('youth', 'little league', 'travel') THEN 'youth'
    WHEN LOWER(v_profile.level) IN ('high_school', 'high school', 'hs', 'varsity', 'jv') THEN 'high_school'
    WHEN LOWER(v_profile.level) IN ('college', 'juco', 'd1', 'd2', 'd3', 'naia') THEN 'college'
    WHEN LOWER(v_profile.level) IN ('pro', 'professional', 'milb', 'minor league', 'minors', 'indy', 'independent') THEN 'pro'
    WHEN LOWER(v_profile.level) IN ('mlb', 'major league', 'majors') THEN 'mlb'
    ELSE NULL
  END;

  -- Create player record
  INSERT INTO public.players (
    name, email, phone, age, level, team, position, handedness,
    weight_lbs, mlb_id, fangraphs_id, bbref_id,
    account_status, can_login, is_public, notes, created_at, updated_at
  )
  VALUES (
    NULLIF(full_name, ''), v_profile.email, v_profile.phone, v_profile.age,
    mapped_level, v_profile.current_team, v_profile.position, mapped_handedness,
    CASE WHEN v_profile.weight IS NULL THEN NULL ELSE v_profile.weight::numeric END,
    v_profile.mlb_id, v_profile.fangraphs_id, v_profile.baseball_reference_id,
    'active', FALSE, FALSE, 'Auto-created via ensure_player_linked', NOW(), NOW()
  )
  RETURNING id INTO v_players_id;

  -- Link profile to player
  UPDATE public.player_profiles
    SET players_id = v_players_id, updated_at = NOW()
    WHERE id = p_profile_id;

  RETURN v_players_id;
END;
$$;