# INTERVIEW QUESTIONS & DATA COLLECTION
## Lead Magnet + Account Setup — Reference Document

**Version:** 1.0  
**Date:** January 30, 2026

---

## OVERVIEW

This document defines:
1. All data fields collected during onboarding
2. The interview questions (profile + Motor Profile feel questions)
3. Scoring logic for Motor Profile preview
4. What gets sent to Reboot for account setup

---

## PART 1: PROFILE DATA FIELDS

### Required Fields

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `name` | string | Interview | First name at minimum |
| `age` | number | Interview | Used for age-appropriate coaching |
| `height` | string | Interview | e.g., "5'11\"" |
| `weight` | number | Interview | In pounds |
| `handedness` | enum | Interview | "R" / "L" / "S" (switch) |
| `position` | string | Interview | Primary position |
| `level` | string | Interview | Travel, HS, College, Pro, etc. |
| `phone` | string | Auto (WhatsApp) | Captured from WhatsApp number |
| `email` | string | Interview | For account setup |

### Optional / Derived Fields

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `wingspan` | number | Interview OR Video | Inches, fingertip to fingertip |
| `ape_index` | number | Calculated | wingspan - height (in inches) |
| `body_type` | enum | Calculated | ROTATIONAL / BALANCED / LINEAR |
| `arm_ratio` | number | Video (Reboot) | Forearm ÷ Upper Arm |

### Parent/Guardian (If Under 18)

| Field | Type | Source |
|-------|------|--------|
| `parent_name` | string | Interview |
| `parent_email` | string | Interview |
| `parent_phone` | string | Interview (optional) |

---

## PART 2: INTERVIEW QUESTIONS — PROFILE

Ask one at a time. Keep it conversational.

### Q1: Name
```
What's your name?
```

### Q2: Age
```
How old are you, [NAME]?
```

### Q3: Height
```
How tall are you?
```
*Accept formats: "5'11", "5 11", "5ft 11in", "71 inches", "180cm"*

### Q4: Weight
```
What do you weigh?
```
*Accept: number in lbs, or convert from kg*

### Q5: Handedness
```
You hit right, left, or switch?
```
*Map to: R / L / S*

### Q6: Position
```
What position do you play?
```
*Accept any position, store as string*

### Q7: Level
```
What level are you playing at right now?
```
*Examples: Travel, 14u, Varsity, JV, College, JUCO, Indy ball, MiLB, etc.*

### Q8: Email
```
What's your email?
```
*Validate email format*

### Q9: Wingspan (Optional)
```
Do you know your wingspan? Fingertip to fingertip, arms straight out.
```
*If unknown: "No worries — we can get it from your swing video."*

### Q10: Parent/Guardian (If Age < 18)
```
Since you're under 18, we'll need a parent or guardian on the account. What's their name and email?
```

---

## PART 3: INTERVIEW QUESTIONS — MOTOR PROFILE (Feel-Based)

These four questions determine the initial Motor Profile preview.

### Q1: Power Source
```
When your swing feels good — where does the power come from?

A) Quick rotation — like snapping a towel
B) Hip lead then hands — like cracking a whip
C) Driving through the ball — pushing off the ground
D) Everything just clicks — hard to describe
```

| Answer | Points |
|--------|--------|
| A | SPINNER +1 |
| B | WHIPPER +1 |
| C | SLINGSHOTTER +1 |
| D | BALANCED +1 |

---

### Q2: Swing Description
```
How would you describe your swing?

A) Compact and quick
B) Long and leveraged
C) Explosive and direct
D) Smooth and powerful
```

| Answer | Points |
|--------|--------|
| A | SPINNER +1 |
| B | WHIPPER +1 |
| C | SLINGSHOTTER +1 |
| D | BALANCED +1 |

---

### Q3: Best Pitch Location
```
Where do you do your best damage?

A) Inside — I turn on it quick
B) Middle-away — I drive it oppo
C) Down the middle — I hammer it
D) Anywhere when I'm locked in
```

| Answer | Points |
|--------|--------|
| A | SPINNER +1 |
| B | WHIPPER +1 |
| C | SLINGSHOTTER +1 |
| D | BALANCED +1 |

---

### Q4: What Goes Wrong
```
When you're off, what usually happens?

A) Roll over, weak grounders to pull side
B) Late, foul stuff off
C) Pop up, get under it
D) Just feel disconnected
```

| Answer | Points |
|--------|--------|
| A | SPINNER +1 |
| B | WHIPPER +1 |
| C | SLINGSHOTTER +1 |
| D | BALANCED +1 |

---

## PART 4: MOTOR PROFILE SCORING

### Calculation

```javascript
function calculateMotorProfilePreview(answers) {
  const scores = {
    SPINNER: 0,
    WHIPPER: 0,
    SLINGSHOTTER: 0,
    BALANCED: 0
  };
  
  // Map answers to profiles
  const mapping = {
    'A': 'SPINNER',
    'B': 'WHIPPER',
    'C': 'SLINGSHOTTER',
    'D': 'BALANCED'
  };
  
  // Count each answer
  answers.forEach(answer => {
    const profile = mapping[answer.toUpperCase()];
    if (profile) scores[profile]++;
  });
  
  // Find highest score
  const maxScore = Math.max(...Object.values(scores));
  const topProfiles = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([profile, _]) => profile);
  
  // If tie or mostly D's, return BALANCED
  if (topProfiles.length > 1 || scores.BALANCED >= 2) {
    return {
      profile: 'BALANCED',
      confidence: 60,
      note: 'Based on feel — needs video confirmation'
    };
  }
  
  // Return top profile
  return {
    profile: topProfiles[0],
    confidence: maxScore === 4 ? 90 : maxScore === 3 ? 80 : 70,
    note: 'Based on feel — confirmed with video analysis'
  };
}
```

### Result Matrix

| Pattern | Result | Confidence |
|---------|--------|------------|
| 4 same | That profile | 90% |
| 3 same | That profile | 80% |
| 2-2 split | BALANCED | 60% |
| 2+ D's | BALANCED | 60% |
| All different | BALANCED | 60% |

---

## PART 5: PROFILE DESCRIPTIONS

### SPINNER
```
Spinners generate power through quick rotation — compact, fast, explosive. 

Think Altuve, Mookie Betts, Jeremy Peña.

You don't need a big swing. You need a FAST swing. Your power comes from how quick you can turn, not how far you can reach.

The danger? Coaches trying to make you extend. That breaks Spinners.
```

### WHIPPER
```
Whippers generate power through hip lead and late hands — leverage, extension, violent brake on the front side.

Think Soto, Freeman.

Your hips fire, your front side STOPS, and your bat whips through like a pendulum.

The danger? "Stay compact" cues. That kills your leverage.
```

### SLINGSHOTTER
```
Slingshotters generate power from the ground up — explosive push, linear drive, force goes into the ground and comes back through the bat.

Think Judge, Vlad Jr.

You're not spinning — you're launching.

The danger? Pure rotation drills. You need that linear base.
```

### BALANCED
```
You're somewhere in between — could go rotation or extension depending on the pitch.

That's actually versatile.

We'd need to see your swing on video to know exactly where you sit. But versatility isn't a bad thing.
```

---

## PART 6: INSIGHT BASED ON "WHAT GOES WRONG"

Give ONE specific insight after the profile reveal.

### If A (Roll over, weak grounders):
```
You said you roll over when you're off. For a [PROFILE], that usually means your timing's too quick — bat's ahead of your body. We'd look at your timing gap to see if that's the leak.
```

### If B (Late, foul stuff off):
```
You said you're late when you're off. For a [PROFILE], that usually means your sequence is out of order — hands going before hips, or no deceleration. We'd look at your kinetic sequence.
```

### If C (Pop up, get under it):
```
You said you pop up when you're off. For a [PROFILE], that usually means your entry angle is off — bat coming in too steep. We'd look at your barrel path.
```

### If D (Feel disconnected):
```
You said you feel disconnected when you're off. That's usually a timing thing — body and bat not synced. We'd need video to pinpoint it, but it's fixable.
```

---

## PART 7: REBOOT ACCOUNT DATA

Fields needed to create a Reboot Motion account:

| Field | Required | Source |
|-------|----------|--------|
| `name` | Yes | Interview |
| `email` | Yes | Interview |
| `age` | Yes | Interview |
| `height` | Yes | Interview |
| `weight` | Yes | Interview |
| `handedness` | Yes | Interview |
| `wingspan` | No | Interview or derived from video |

### API Payload Example

```json
{
  "player": {
    "name": "Marcus Thompson",
    "email": "marcus@email.com",
    "age": 16,
    "height_inches": 71,
    "weight_lbs": 175,
    "handedness": "R",
    "wingspan_inches": 73
  },
  "metadata": {
    "source": "catching_barrels",
    "initial_profile": "SPINNER",
    "profile_confidence": 80,
    "onboarded_at": "2026-01-30T14:30:00Z"
  }
}
```

---

## PART 8: CONVERSATION FLOW SUMMARY

```
┌─────────────────────────────────────────────┐
│           NEW CONTACT FLOW                  │
├─────────────────────────────────────────────┤
│                                             │
│  1. WELCOME                                 │
│     "Want to find your Motor Profile?"      │
│              ↓                              │
│  2. PROFILE DATA (9-10 questions)           │
│     Name → Age → Height → Weight →          │
│     Handedness → Position → Level →         │
│     Email → Wingspan → Parent (if <18)      │
│              ↓                              │
│  3. MOTOR PROFILE FEEL QUESTIONS (4 Qs)     │
│     Power Source → Swing Description →      │
│     Best Location → What Goes Wrong         │
│              ↓                              │
│  4. CALCULATE PROFILE                       │
│     Score answers → Determine profile       │
│              ↓                              │
│  5. DELIVER RESULT                          │
│     Profile + Description + Insight         │
│              ↓                              │
│  6. NEXT STEP                               │
│     Upload video / Sign up / Ask questions  │
│              ↓                              │
│  7. ACCOUNT SETUP (if converting)           │
│     Send data to Reboot → Create account    │
│                                             │
└─────────────────────────────────────────────┘
```

---

*Last Updated: January 30, 2026*
