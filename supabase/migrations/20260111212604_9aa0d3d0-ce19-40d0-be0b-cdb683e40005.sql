-- Backfill existing records - create players rows for each player_profiles without mapping
-- Skip constrained fields that don't match (level, handedness)
DO $$
DECLARE
  profile_record RECORD;
  new_player_id uuid;
  valid_handedness text;
  valid_level text;
  full_name text;
BEGIN
  FOR profile_record IN 
    SELECT id, first_name, last_name, level, bats, throws, current_team, organization, phone, email, age
    FROM player_profiles 
    WHERE players_id IS NULL
  LOOP
    -- Convert bats to handedness format
    CASE profile_record.bats
      WHEN 'L' THEN valid_handedness := 'left';
      WHEN 'R' THEN valid_handedness := 'right';
      WHEN 'S' THEN valid_handedness := 'switch';
      WHEN 'left' THEN valid_handedness := 'left';
      WHEN 'right' THEN valid_handedness := 'right';
      WHEN 'switch' THEN valid_handedness := 'switch';
      ELSE valid_handedness := NULL;
    END CASE;
    
    -- Convert level to valid format (youth, high_school, college, pro, mlb)
    CASE LOWER(COALESCE(profile_record.level, ''))
      WHEN 'youth' THEN valid_level := 'youth';
      WHEN 'high_school' THEN valid_level := 'high_school';
      WHEN 'hs' THEN valid_level := 'high_school';
      WHEN 'college' THEN valid_level := 'college';
      WHEN 'pro' THEN valid_level := 'pro';
      WHEN 'mlb' THEN valid_level := 'mlb';
      WHEN 'milb' THEN valid_level := 'pro';
      ELSE valid_level := NULL;
    END CASE;
    
    -- Build full name
    full_name := TRIM(COALESCE(profile_record.first_name, '') || ' ' || COALESCE(profile_record.last_name, ''));
    IF full_name = '' OR full_name = ' ' THEN
      full_name := 'Unknown Player';
    END IF;
    
    -- Create a new players row (only include valid constrained values)
    INSERT INTO players (
      name,
      level,
      handedness,
      team,
      phone,
      email,
      age,
      notes
    ) VALUES (
      full_name,
      valid_level,
      valid_handedness,
      COALESCE(profile_record.current_team, profile_record.organization),
      profile_record.phone,
      profile_record.email,
      profile_record.age,
      'Auto-created from player_profiles.id: ' || profile_record.id::text
    )
    RETURNING id INTO new_player_id;
    
    -- Update the player_profiles row with the new players_id
    UPDATE player_profiles 
    SET players_id = new_player_id 
    WHERE id = profile_record.id;
  END LOOP;
END $$;