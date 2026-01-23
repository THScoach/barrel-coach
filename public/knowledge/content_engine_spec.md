# Catching Barrels Content Engine
## Build Spec for Lovable

---

## What This Is

A system that turns Coach Rick's natural conversations, voice memos, and videos into ready-to-post content across platforms - without him having to "create content."

**Core Principle:** Rick talks. The system produces.

---

## The Problem

Rick has:
- Thousands of conversations (Claude, ChatGPT) full of insights
- Knowledge that comes out naturally when he's explaining things
- No time to sit down and "create content"
- A brand that depends on HIS voice, not generic AI output

Current state: All this thinking happens, then disappears. Nothing gets captured, formatted, or distributed.

---

## The Solution: Content Engine

### Input Sources (What Goes In)

1. **Conversations** 
   - Claude project chats (like this one)
   - ChatGPT exports
   - Any AI conversation where Rick is working through ideas

2. **Voice Memos**
   - Quick recordings from phone
   - Thoughts after a lesson
   - Reactions to something he saw

3. **Video Clips**
   - Rick talking to camera
   - Screen recordings explaining concepts
   - Snippets from coaching sessions (with permission)

4. **Swing Analysis Sessions**
   - Insights that come out during player assessments
   - Before/after observations
   - Motor Profile explanations

---

### Processing Layer (What Happens)

**Step 1: Capture**
- Content lands in a queue (upload, paste, or auto-sync)
- Source is tagged (conversation, voice, video, session)
- Timestamp and context preserved

**Step 2: Extract**
- AI identifies the "gold" - the teachable moment, insight, or hook
- Pulls out quotable phrases in Rick's voice
- Tags by topic: Motor Profile, Transfer Ratio, Tempo, Drill, Mindset, Story, etc.
- Flags content type: Educational, Controversial take, Personal story, Quick tip

**Step 3: Format**
- Transforms raw insight into platform-specific formats:

| Platform | Format | Length | Style |
|----------|--------|--------|-------|
| TikTok/Reels | Hook + Insight + CTA | 30-60 sec script | Punchy, direct |
| Instagram Caption | Story + Lesson + Question | 150-300 words | Conversational |
| Twitter/X | Single insight or thread | 280 char or 5-7 tweets | Sharp, quotable |
| YouTube Short | Problem + Explanation + Takeaway | 60 sec script | Educational |
| Knowledge Base | Full explanation | 500-1000 words | Reference material |
| Course Module | Structured lesson | 3-5 min script | Teaching format |

**Step 4: Queue**
- Content sits in approval queue
- Rick reviews, approves, or edits
- One-click post or schedule
- Can batch approve multiple pieces

---

### Output Destinations (Where It Goes)

**Social Platforms:**
- TikTok
- Instagram (Feed, Reels, Stories)
- Twitter/X
- YouTube Shorts
- Facebook

**Catching Barrels Ecosystem:**
- Knowledge Base (app)
- Course content library
- Coach Rick AI training data
- Email newsletter content
- Blog posts

---

## User Flow (Rick's Experience)

### Daily Flow (5 minutes)
1. Open Content Engine dashboard
2. See 3-5 pieces ready for approval
3. Quick preview each one
4. Approve, edit, or trash
5. Done - system handles posting

### Creation Flow (Passive)
1. Have a conversation like this one
2. Record a voice memo after a lesson
3. Shoot a quick video explaining something
4. System captures it automatically
5. Shows up in queue next day

### On-Demand Flow
1. "I want to post about Transfer Ratio today"
2. System pulls from existing captured content on that topic
3. Shows options already formatted
4. Or generates new content based on Rick's past explanations of that topic

---

## Key Features

### 1. Voice Capture
- Record directly in app
- Auto-transcribe
- Extract insights automatically
- Suggest which platforms it fits

### 2. Conversation Import
- Paste conversation or connect to Claude/ChatGPT
- AI scans for content-worthy moments
- Pulls quotes, insights, frameworks
- Maintains Rick's exact language

### 3. Content Calendar
- See what's scheduled
- Identify gaps (haven't posted about X in 2 weeks)
- Suggest topics based on what's trending or seasonal

### 4. Brand Voice Lock
- All output sounds like Rick
- Direct, no fluff
- Uses his terminology (4B, Motor Profile, Transfer Ratio, etc.)
- Hormozi-style clarity
- Never generic AI-speak

### 5. Platform Optimization
- Hashtag suggestions per platform
- Best posting times
- Format automatically adjusted
- Thumbnail/cover suggestions for video

### 6. Analytics Dashboard
- What's performing
- Which topics resonate
- Best formats for Rick's audience
- Content ROI (which pieces drive app signups)

---

## Technical Requirements

### Integrations Needed
- Transcription service (Whisper API or similar)
- Social platform APIs (Meta, TikTok, Twitter, YouTube)
- Cloud storage for media
- Scheduling service
- Analytics aggregation

### Database Schema (Simplified)

```
content_items
- id
- source_type (conversation, voice, video, session)
- raw_content (original text/transcript)
- extracted_insights (array)
- topics (array of tags)
- status (pending, approved, posted, archived)
- created_at
- processed_at

content_outputs
- id
- content_item_id (source)
- platform (tiktok, instagram, twitter, etc.)
- formatted_content
- media_urls (if applicable)
- status (draft, approved, scheduled, posted)
- scheduled_for
- posted_at
- performance_metrics (JSON)

topics
- id
- name (motor_profile, transfer_ratio, tempo, etc.)
- content_count
- last_posted

```

### AI Processing Pipeline

1. **Input Processing**
   - Audio → Transcription
   - Video → Transcription + Key frame extraction
   - Text → Clean and normalize

2. **Insight Extraction**
   - Identify teaching moments
   - Find quotable phrases
   - Detect frameworks/concepts
   - Tag topics

3. **Content Generation**
   - Apply platform templates
   - Maintain voice consistency
   - Add hooks and CTAs
   - Generate variations

4. **Quality Check**
   - Brand voice score
   - Engagement prediction
   - Duplicate detection
   - Fact check against knowledge base

---

## MVP Scope (Phase 1)

**Build first:**
1. Voice memo capture + transcription
2. Conversation paste + extraction
3. Single platform output (Instagram)
4. Simple approval queue
5. Manual posting (copy/paste)

**Add in Phase 2:**
- Video processing
- Multi-platform formatting
- Direct posting via APIs
- Content calendar
- Analytics

**Add in Phase 3:**
- Auto-scheduling
- Performance optimization
- Course module generation
- Knowledge base auto-update
- Coach AI training integration

---

## Success Metrics

- Rick spends <10 min/day on content
- 1-2 posts per day across platforms
- Content sounds like Rick (subjective but critical)
- Engagement rates match or beat manually created content
- App signups attributed to content increase

---

## Voice & Tone Guide

**Rick's content voice:**
- Direct, not salesy
- Confident, backed by experience
- Uses specific terminology (not dumbed down)
- Stories and examples from real players
- Challenges conventional thinking
- "Here's what most people get wrong..."
- "The data shows X, but here's WHY..."
- Never apologetic, never hedging

**Phrases Rick uses:**
- "We don't add, we unlock"
- "Data as compass, not judgment"
- "They measure WHAT, I explain WHY"
- "The swing is a sequence, not a position"
- "Averages hide the truth, timing reveals it"

**Topics Rick owns:**
- Motor Profiles (Spinner, Slingshotter, Whipper, Titan)
- Transfer Ratio
- 4B Framework (Ball, Bat, Body, Brain)
- Tempo and timing
- Why experience matters in a data world
- The Driveline/data-first critique
- Unlocking vs. adding

---

## Notes for Development

- Start simple - the value is in CAPTURE, not fancy features
- Rick needs to feel like he's not "doing content" - it just happens
- Voice is everything - if it doesn't sound like Rick, it fails
- Mobile-first for capture (he's at the field, not at a desk)
- Integration with existing Catching Barrels app is eventual goal