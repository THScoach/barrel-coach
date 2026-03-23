
UPDATE player_sessions 
SET raw_metrics = raw_metrics || '{
  "predicted_contact": {
    "confidence": "MEDIUM",
    "energy_archetype": null,
    "energy_archetype_label": null,
    "primary_compensation": "SEQUENCE",
    "severity": 3,
    "barrel_path": {
      "plane_type": "STEEP",
      "entry_timing": "LATE",
      "contact_depth": "SHALLOW"
    },
    "tendencies": {
      "ground_ball": "HIGH",
      "line_drive": "LOW",
      "fly_ball": "MEDIUM",
      "pop_up_risk": "MEDIUM",
      "direction": "PULL",
      "hard_hit_potential": "LOW",
      "sweet_spot_proxy": "LOW"
    },
    "plane_length_pct": 35,
    "predicted_ball_score": 21
  }
}'::jsonb
WHERE id = '06935085-e2c1-4b2c-9f9e-51028889f63d';
