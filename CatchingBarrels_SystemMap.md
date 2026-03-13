# Catching Barrels — System Map

> Generated: March 13, 2026 — **Audit only, no code changes**
> Purpose: Master reference for v2 architecture planning

---

## 1. Route / Page Registry

### Public & Marketing

| File | URL | Purpose |
|------|-----|---------|
| `src/pages/Landing.tsx` | `/` | Marketing landing page |
| `src/pages/Index.tsx` | `/index` | Alternative home/index page |
| `src/pages/About.tsx` | `/about` | About page |
| `src/pages/Coaching.tsx` | `/coaching` | Coaching services overview |
| `src/pages/Pricing.tsx` | `/pricing` | Pricing tiers |
| `src/pages/Beta.tsx` | `/beta` | Beta program info |
| `src/pages/Apply.tsx` | `/apply` | Apply for program |
| `src/pages/Consent.tsx` | `/consent` | Consent / waiver form |
| `src/pages/InnerCircle.tsx` | `/inner-circle` | Inner Circle membership |
| `src/pages/Privacy.tsx` | `/privacy` | Privacy policy |
| `src/pages/Terms.tsx` | `/terms` | Terms of service |
| `src/pages/NotFound.tsx` | `*` | 404 catch-all |

### Auth

| File | URL | Purpose |
|------|-----|---------|
| `src/pages/Login.tsx` | `/login` | User login |
| `src/pages/Signup.tsx` | `/signup` | User registration |
| `src/pages/Welcome.tsx` | `/welcome` | Post-signup onboarding |

### Core App (Athlete-Facing)

| File | URL | Purpose |
|------|-----|---------|
| `src/pages/Athletes.tsx` | `/athletes` | Athlete roster list |
| `src/pages/AthleteDetail.tsx` | `/athletes/:id` | Single athlete profile with session history |
| `src/pages/Upload.tsx` | `/upload` | Multi-video group upload |
| `src/pages/SwingUpload.tsx` | `/analyze` | Standalone swing video upload for 2D analysis |
| `src/pages/Analyze.tsx` | `/analysis` | Analysis results display |
| `src/pages/SessionView.tsx` | `/session/:sessionId`, `/sessions/:sessionId` | View a specific session |
| `src/pages/Session.tsx` | `/session` | Generic session page |
| `src/pages/SwingReport.tsx` | `/report/:sessionId` | Full KRS/4B swing report |
| `src/pages/Dashboard.tsx` | `/dashboard` | General dashboard |
| `src/pages/Diagnostic.tsx` | `/diagnostic` | Free diagnostic tool |
| `src/pages/Diagrams.tsx` | `/diagrams` | Napkin-generated diagrams |
| `src/pages/Drills.tsx` | `/drills` | Drill library (public) |
| `src/pages/DrillDetail.tsx` | `/drills/:slug` | Single drill detail page |
| `src/pages/Library.tsx` | `/library` | Video library / academy |
| `src/pages/Assessment.tsx` | `/assessment` | Paid assessment checkout |
| `src/pages/ConnectDK.tsx` | `/connect-dk` | Diamond Kinetics OAuth flow |
| `src/pages/FreeDiagnosticReport.tsx` | `/free-diagnostic` | Free diagnostic report |
| `src/pages/MyData.tsx` | `/my-data` | Player's own data view |
| `src/pages/Results.tsx` | `/results` | Analysis results page |
| `src/pages/SocialClips.tsx` | `/social-clips` | Social clip generation |
| `src/pages/ReportWireframes.tsx` | `/report-wireframes` | Report layout wireframes |
| `src/pages/Rick.tsx` | `/rick` | RickBot AI chat (admin-protected) |

### Player Portal (`/player/*`)

| File | URL | Purpose |
|------|-----|---------|
| `src/pages/player/PlayerHome.tsx` | `/player`, `/player/home` | Player home dashboard |
| `src/pages/player/PlayerDashboard4B.tsx` | `/player/dashboard` | 4B score dashboard with pillar drill-down |
| `src/pages/player/PlayerDrills.tsx` | `/player/drills` | Assigned drills |
| `src/pages/player/PlayerProfile.tsx` | `/player/profile` | Player profile settings |
| `src/pages/player/PlayerMessages.tsx` | `/player/messages` | Locker room messages |
| `src/pages/player/PlayerData.tsx` | `/player/data` | Player data/metrics |
| `src/pages/player/PlayerGhostLab.tsx` | `/player/ghost-lab` | Ghost session detection lab |
| `src/pages/player/PlayerGhostRecovery.tsx` | `/player/ghost-recovery` | Ghost session recovery |
| `src/pages/player/PlayerWeeklyCheckin.tsx` | `/player/weekly-checkin` | Weekly game report check-in |
| `src/pages/player/PlayerNewSession.tsx` | `/player/new-session` | Start a new session |
| `src/pages/player/CoachChat.tsx` | `/player/coach-chat` | Chat with Coach Rick AI |
| `src/pages/player/PlayerSwings.tsx` | `/player/swings` | DK swing sessions list |
| `src/pages/player/PlayerSwingDetail.tsx` | `/player/swings/:sessionId` | DK swing session detail |
| `src/pages/player/PlayerProgression.tsx` | `/player/progression` | 4B score trend lines + coaching layer |

### Admin (`/admin/*`, all `ProtectedAdminRoute`)

| File | URL | Purpose |
|------|-----|---------|
| `src/pages/AdminDashboard.tsx` | `/admin`, `/admin/dashboard` | Admin home dashboard |
| `src/pages/AdminPlayers.tsx` | `/admin/players` | Player roster management |
| `src/pages/AdminPlayerProfile.tsx` | `/admin/players/:id` | Admin view of single player |
| `src/pages/AdminAnalyzer.tsx` | `/admin/analyzer` | Swing analyzer tool |
| `src/pages/AdminSessionView.tsx` | `/admin/session/:id` | Admin session detail |
| `src/pages/AdminNewSession.tsx` | `/admin/new-session` | Create new session |
| `src/pages/AdminSessionSetup.tsx` | `/admin/session-setup` | Session setup wizard |
| `src/pages/AdminSwingSessionUpload.tsx` | `/admin/swing-upload` | Bulk swing upload |
| `src/pages/AdminBroadcast.tsx` | `/admin/broadcast` | Broadcast email to players |
| `src/pages/AdminMessages.tsx` | `/admin/messages` | Web message management |
| `src/pages/AdminSMS.tsx` | `/admin/sms` | SMS campaign management |
| `src/pages/AdminInvites.tsx` | `/admin/invites` | Player invite management |
| `src/pages/AdminLibrary.tsx` | `/admin/library` | Video library admin |
| `src/pages/AdminVideos.tsx` | `/admin/videos` | Video CRUD management |
| `src/pages/AdminVault.tsx` | `/admin/vault` | Knowledge vault |
| `src/pages/AdminCoachRickVault.tsx` | `/admin/coach-rick-vault` | Coach Rick's knowledge vault |
| `src/pages/AdminKnowledgeBase.tsx` | `/admin/knowledge-base` | Knowledge base browser |
| `src/pages/AdminContentEngine.tsx` | `/admin/content-engine` | Social content generation engine |
| `src/pages/AdminProspectLab.tsx` | `/admin/prospect-lab` | Prospect research pipeline |
| `src/pages/AdminRebootAnalysis.tsx` | `/admin/reboot-analysis` | Reboot Motion analysis runner |
| `src/pages/AdminReportQueue.tsx` | `/admin/report-queue` | Pending report queue |
| `src/pages/AdminValidationQueue.tsx` | `/admin/validation-queue` | Video-Reboot correlation queue |
| `src/pages/AdminHitTraxImport.tsx` | `/admin/hittrax-import` | HitTrax CSV import |
| `src/pages/AdminImportKommodo.tsx` | `/admin/import-kommodo` | Kommodo data import |
| `src/pages/AdminSeedSwingData.tsx` | `/admin/seed-swing-data` | Seed/test swing data generator |
| `src/pages/admin/CoachRickAIAdmin.tsx` | `/admin/coach-rick-ai` | Coach Rick AI settings |
| `src/pages/admin/CoachRickAITestChat.tsx` | `/admin/coach-rick-ai/test` | Coach Rick AI test chat |
| `src/pages/admin/CoachRickAIVideos.tsx` | `/admin/coach-rick-ai/videos` | Coach Rick AI video library |
| `src/pages/admin/CueBankManager.tsx` | `/admin/cue-bank` | Coaching cue bank CRUD |
| `src/pages/admin/KnowledgeBaseEditor.tsx` | `/admin/knowledge-editor` | Knowledge base editor |
| `src/pages/admin/ScenarioTrainer.tsx` | `/admin/scenario-trainer` | AI scenario training |
| `src/pages/admin/VideoScriptAnalyzer.tsx` | `/admin/video-script-analyzer` | Video script analysis tool |

**Total: 72 routes across 68 page files**

---

## 2. Supabase Tables → Component Usage

### Core Player Data
| Table | Queried By |
|-------|-----------|
| `players` | AdminPlayers, AdminPlayerProfile, PlayerHome, PlayerProfile, PlayerDashboard4B, PlayerProgression, multiple admin components, edge functions |
| `player_profiles` | AdminPlayerProfile (profile→player linking), Login/Signup (auth linking), ProfileLinkingManager |
| `user_roles` | ProtectedAdminRoute, AuthContext (admin check via `has_role` / `is_admin`) |

### Sessions & Scores
| Table | Queried By |
|-------|-----------|
| `sessions` | SessionView, SwingReport, AdminSessionView, PlayerDataTab, AdminAnalyzer, Analyze, ResultsPage |
| `swings` | SessionView, SwingReport (individual swing data within sessions) |
| `player_sessions` | PlayerScoresTabNew, PlayerProgression, PlayerDashboard4B, KineticSequenceTab, AdminRescorePanel, 4b-scores-api.ts |
| `reboot_uploads` | PlayerRebootMotionTab, PlayerScoresTabNew, PlayerDataTab, PendingRebootQueue, ValidationQueue, ManualRebootUpload |
| `reboot_sessions` | PlayerRebootMotionTab, RebootSessionDetailDrawer, sync-reboot-sessions edge fn |
| `hittrax_sessions` | HitTraxSessionDetail, HitTraxUploadModal, AdminHitTraxImport, PlayerDataTab |
| `launch_monitor_sessions` | LaunchMonitorSessionDetail, PlayerDataTab |
| `video_2d_sessions` | useDualPathAnalysis, Video2DAnalysisCard, PlayerVideoTab |
| `video_swing_sessions` | ValidationQueue, SessionValidationOverlay |
| `video_swing_events` | (swing event timestamps within 2D sessions) |
| `swing_leaks` | (detected mechanical faults from 2D analysis) |

### Sensor & Biomechanics
| Table | Queried By |
|-------|-----------|
| `capture_sessions` | PlayerSwings (DK capture sessions) |
| `captured_swings` | PlayerSwingDetail (individual DK swings) |
| `sensor_sessions` | GhostLab, ghost_sessions FK |
| `ghost_sessions` | PlayerGhostLab, PlayerGhostRecovery |
| `kinetic_fingerprints` | PlayerDashboard4B, fingerprint components |
| `kinetic_fingerprint_history` | Progression tracking |
| `batted_ball_events` | Ball flight / batted ball analysis |
| `athlete_krs_models` | Custom KRS coefficients per player |

### DK Integration
| Table | Queried By |
|-------|-----------|
| `dk_accounts` | useDKAccount, DKConnectionBadge, PlayerDKSessionsTab, ConnectDK |
| `dk_sync_log` | DK sync status display |
| `dk_token_cache` | DK OAuth edge functions |

### Communication
| Table | Queried By |
|-------|-----------|
| `web_messages` | AdminMessages, PlayerMessages (locker room) |
| `coach_conversations` | AdminSMS, coach SMS history |
| `communication_logs` | Communication audit trail |
| `chat_logs` | CoachChat, CoachRickChat, WeeklyCheckinChat |
| `blocked_numbers` | SMS blocking |
| `invites` | AdminInvites |

### Drills & Programs
| Table | Queried By |
|-------|-----------|
| `drills` | Drills, DrillDetail, PlayerDrills, DrillIntelTab, drill_prescriptions |
| `drill_completions` | PlayerDrills (completion tracking) |
| `drill_prescriptions` | DrillIntelTab, prescribe-drills edge fn |
| `drill_videos` | AdminVideos, Library, VideosTab, search functions |
| `player_drill_assignments` | PlayerDrills |
| `programs` / `player_programs` | ProgramsTab |

### Coach Rick AI
| Table | Queried By |
|-------|-----------|
| `clawdbot_knowledge` | KnowledgeBaseEditor, CoachRickAIAdmin |
| `clawdbot_cues` | CueBankManager |
| `clawdbot_scenarios` | ScenarioTrainer |
| `clawdbot_ratings` | CoachRickAIAdmin (response ratings) |
| `coach_rick_rules` | CoachRickAIAdmin |

### Content Engine
| Table | Queried By |
|-------|-----------|
| `content_items` | AdminContentEngine, ContentQueue |
| `content_outputs` | ContentQueue (platform-specific posts) |
| `content_topics` | AdminContentEngine |

### Gamification
| Table | Queried By |
|-------|-----------|
| `weekly_challenges` / `challenge_entries` | Gamification engine |
| `xp_log` | XP tracking (via `award_xp` function) |
| `game_weekly_reports` | PlayerWeeklyCheckin |

### Admin/Research
| Table | Queried By |
|-------|-----------|
| `activity_log` | PlayerActivityTab |
| `agent_actions_log` | Agent action tracking |
| `coach_api_audit_log` | API audit trail |
| `final_research_briefs` | AdminProspectLab |
| `knowledge_documents` | AdminVault, AdminCoachRickVault |
| `video_playlists` / `playlist_videos` | Library playlists |
| `player_video_prescriptions` | Video recommendations |

---

## 3. Edge Functions Registry

### Scoring & Analysis (Core Engine)
| Function | Trigger | Purpose |
|----------|---------|---------|
| `calculate-4b-scores` | Called by admin UI, backfill, score-session flows | Core 4B scoring engine — computes Body/Brain/Bat/Ball from session data |
| `backfill-4b-scores` | Admin "Rescore All" button | Batch re-processes all Reboot sessions through 4B engine |
| `compute-4b-from-csv` | Admin Reboot analysis | Parses IK/ME CSV and computes 4B scores |
| `analyze-swing` | Session completion | Analyzes a single swing from sensor data |
| `analyze-swings` | Batch swing analysis | Analyzes multiple swings |
| `analyze-reboot-biomechanics` | Reboot session processing | Deep biomechanics analysis from Reboot data |
| `score-monitor` | Scheduled/manual | Monitors scoring health |
| `calibrate-athlete-model` | Admin per-player | Calibrates custom KRS regression model |
| `score-voice-consistency` | Analysis pipeline | Scores voice/tempo consistency |

### 2D Video Analysis
| Function | Trigger | Purpose |
|----------|---------|---------|
| `analyze-video-2d` | Video upload completion | Gemini-powered 2D video swing analysis |
| `analyze-swing-2d` | Alternate 2D analysis path | Secondary 2D swing analyzer |
| `analyze-video-swing-session` | Multi-swing video | Analyzes full video session with multiple swings |
| `mediapipe-analyze` | Client-side pose request | MediaPipe pose estimation |
| `sam3-segment` | Client request | SAM3 segmentation |

### Reboot Motion Integration
| Function | Trigger | Purpose |
|----------|---------|---------|
| `sync-reboot-sessions` | Admin/cron | Syncs sessions from Reboot Motion API |
| `fetch-reboot-sessions` | Admin UI | Fetches session list from Reboot |
| `fetch-reboot-session-data` | Session detail view | Fetches CSV/detail data for one session |
| `fetch-reboot-players` | RebootPlayerImportModal | Lists athletes in Reboot org |
| `process-reboot-session` | Post-sync processing | Processes a synced Reboot session |
| `poll-reboot-sessions` | Cron | Polls for new Reboot sessions |
| `reboot-motion-polling` | Cron | Alternative Reboot polling |
| `reboot-poll-status` | Status check | Checks Reboot polling status |
| `reboot-polling-sync` | Cron | Sync via polling |
| `manual-reboot-upload` | Admin UI | Manual CSV upload to Reboot pipeline |
| `upload-to-reboot` | Video upload flow | Sends video to Reboot Motion |
| `reboot-upload-video` | Alternate upload path | Uploads video to Reboot |
| `create-reboot-athlete` | Admin UI | Creates athlete in Reboot org |
| `reboot-create-player` | Alternate create path | Creates player in Reboot |
| `reboot-export-data` | AthleteDetail import button | Exports data from Reboot for a session |
| `browserbase-reboot` | Headless browser automation | Browser-based Reboot interaction |
| `create-reference-athlete` | Admin | Creates reference athlete for benchmarking |
| `create-reference-session` | Admin | Creates reference session data |

### Diamond Kinetics Integration
| Function | Trigger | Purpose |
|----------|---------|---------|
| `dk-oauth-init` | ConnectDK page | Initiates DK OAuth flow |
| `dk-oauth-callback` | OAuth redirect | Handles DK OAuth callback |
| `dk-sync` | Manual/cron | Syncs DK sessions |
| `dk-auto-sync` | Cron | Automated DK sync |
| `dk-fetch-sessions` | Player swings view | Fetches DK session data |
| `dk-link-players` | Admin | Links DK accounts to players |
| `dk-machine-sync` | Cron | Machine-level DK sync |
| `dk-4b-inverse` | Analysis | Reverse-engineers 4B from DK metrics |
| `manual-dk-upload` | Admin | Manual DK data import |
| `coach-set-dk-email` | SMS/chat | Sets DK email for a player |

### Session Management
| Function | Trigger | Purpose |
|----------|---------|---------|
| `create-session` | New session flow | Creates a new analysis session |
| `create-player-session` | Player portal | Creates player-initiated session |
| `create-in-person-session` | Admin | Creates in-person session record |
| `end-session` | Session completion | Finalizes a session |
| `get-session` | Session view | Retrieves session data |
| `save-analysis` | Post-analysis | Persists analysis results |
| `upload-swing` | Video upload | Uploads swing video to storage |
| `upload-video` | Video upload | General video upload handler |
| `player-trendboard` | Player dashboard | Generates trend data for player |

### Reports & Output
| Function | Trigger | Purpose |
|----------|---------|---------|
| `get-report` | SwingReport page | Fetches full lab report data |
| `generate-swing-report` | Post-analysis | Generates formatted swing report |
| `send-results` | Post-report | Sends results to player |
| `send-analysis-complete` | Post-analysis | Notification that analysis is done |
| `generate-social-post` | Admin/player | Generates social media post from session |
| `extract-video-clips` | Post-analysis | Extracts highlight clips from video |

### Communication
| Function | Trigger | Purpose |
|----------|---------|---------|
| `send-sms` | Various triggers | Sends SMS via Twilio |
| `send-coach-rick-sms` | Coach Rick AI | Sends Coach Rick SMS |
| `coach-rick-sms` | Inbound SMS routing | Handles Coach Rick SMS conversations |
| `schedule-sms` | Admin SMS scheduler | Schedules future SMS |
| `cancel-sms` | Admin | Cancels scheduled SMS |
| `process-sms-triggers` | Cron/DB trigger | Processes SMS trigger queue |
| `session-complete-sms` | Session completion | Sends session complete notification |
| `twilio-webhook` | Twilio inbound | Handles inbound SMS/calls |
| `send-invite` | AdminInvites | Sends player invite |
| `send-beta-invite` | Admin | Sends beta program invite |
| `send-dk-setup-link` | Admin | Sends DK setup link to player |
| `send-player-email` | Admin | Sends email to player |
| `broadcast-email` | AdminBroadcast | Sends bulk email |
| `send-weekly-lab-report` | Cron | Sends weekly lab report email |
| `admin-messages` | AdminMessages | Web message CRUD |
| `admin-sms` | AdminSMS | SMS management API |
| `unsubscribe` | Email link | Handles email unsubscribe |

### Coach Rick AI
| Function | Trigger | Purpose |
|----------|---------|---------|
| `coach-rick-ai-chat` | Chat UI (admin + player) | Main Coach Rick AI conversation |
| `rickbot-command` | Admin chat | RickBot admin commands |
| `rickbot-transcribe` | Voice input | Transcribes voice for RickBot |
| `ask-the-lab` | Admin Lab Chat | "Ask the Lab" AI research assistant |
| `generate-coach-message` | Automated coaching | Generates coaching messages |
| `get-player-context` | AI chat | Fetches player context for AI |
| `process-coach-rick-video` | Video processing | Processes video for Coach Rick knowledge |
| `weekly-checkin` | Player weekly form | Processes weekly check-in data |

### Content Engine
| Function | Trigger | Purpose |
|----------|---------|---------|
| `process-content` | ContentEngine UI | Processes content items for social |
| `generate-content-suggestion` | ContentEngine | AI content suggestions |
| `suggest-trending-topics` | ContentEngine | Trending topic suggestions |
| `post-to-social` | ContentEngine | Posts to social platforms |
| `analyze-video-script` | VideoScriptAnalyzer | Analyzes video script content |
| `auto-tag-video` | Video upload | Auto-tags uploaded videos |
| `transcribe-video` | Video processing | Transcribes video audio |
| `import-onform-video` | Admin | Imports OnForm video |
| `upload-to-gumlet` | Video processing | Uploads to Gumlet CDN |
| `gumlet-webhook` | Gumlet callback | Handles Gumlet processing webhook |

### Research & Scouting
| Function | Trigger | Purpose |
|----------|---------|---------|
| `prospect-research-pipeline` | AdminProspectLab | Full prospect research pipeline |
| `research-player` | Admin | Researches a player (web scraping) |
| `scrape-player-profile` | Admin | Scrapes player profile data |
| `baseball-savant-lookup` | Admin | Looks up Statcast data |
| `fangraphs-lookup` | Admin | Looks up FanGraphs data |
| `generate-napkin-diagram` | Diagrams page | Generates visual diagrams |

### Admin & Utilities
| Function | Trigger | Purpose |
|----------|---------|---------|
| `admin-videos` | AdminVideos | Video CRUD API |
| `master-admin-sync` | Admin | Master sync orchestrator |
| `merge-player-accounts` | Admin | Merges duplicate player records |
| `kommodo-import` | AdminImportKommodo | Imports Kommodo data |
| `search-vault` | AdminVault | Searches knowledge vault |
| `process-vault-document` | AdminVault | Processes uploaded document |
| `queue-deep-analysis` | Admin | Queues deep analysis job |
| `noa-webhook` | External webhook | Handles NOA webhooks |
| `recover-ghost-session` | PlayerGhostRecovery | Recovers ghost DK session |
| `prescribe-drills` | Post-analysis | Auto-prescribes drills based on scores |

### Payments
| Function | Trigger | Purpose |
|----------|---------|---------|
| `create-checkout` | Pricing page | Creates Stripe checkout |
| `create-assessment-checkout` | Assessment page | Creates assessment checkout |
| `create-coaching-checkout` | Coaching page | Creates coaching checkout |
| `create-inner-circle-checkout` | InnerCircle page | Creates membership checkout |
| `create-krs-assessment-checkout` | KRS assessment | Creates KRS checkout |
| `create-subscription-checkout` | Subscription flow | Creates subscription checkout |
| `stripe-webhook` | Stripe | Handles Stripe webhooks |

### Coach API (External SMS Bot)
| Function | Trigger | Purpose |
|----------|---------|---------|
| `coach-analyze-external` | External API | Analyzes swing from external source |
| `coach-daily-report` | Cron | Generates daily coach report |
| `coach-get-pending-sensors` | Coach API | Gets pending sensor connections |
| `coach-mark-sensor-connected` | Coach API | Marks sensor as connected |
| `coach-player-lookup` | Coach API | Looks up player by phone |
| `coach-player-update` | Coach API | Updates player data |

**Total: ~115 edge functions**

---

## 4. Duplicated Logic

### 🔴 4B Scoring (CRITICAL — 5+ implementations)
| Location | What It Does |
|----------|-------------|
| `src/lib/fourBScoring.ts` | Client-side 4B scoring with age caps |
| `src/lib/sensor-analysis/four-b-scoring.ts` | Sensor-based 4B scoring (Kwon engine) |
| `src/lib/reboot-parser.ts` → `FourBScores` + `calculate4BScores()` | Reboot CSV-based 4B scoring |
| `src/components/report/FourBScoreboardExpanded.tsx` | Inline `calculateBodyScore()` / `calculateBrainScore()` in UI component |
| `supabase/functions/calculate-4b-scores/` | Server-side 4B engine (edge function) |
| `supabase/functions/compute-4b-from-csv/` | CSV→4B edge function |
| `src/lib/fourb-composite.ts` | Composite score calculation |
| `src/lib/kesp-engine.ts` | KESP (Kinetic Energy Scoring Protocol) — another scoring variant |

**Impact**: Scores can differ depending on which path data takes. KRS weighting (BODY×0.45 + BRAIN×0.15 + BAT×0.25 + BALL×0.15) may not be consistent across all 5+ implementations.

### 🔴 FourBScores Type Definition (4+ definitions)
| Location |
|----------|
| `src/types/analysis.ts` |
| `src/lib/fourBScoring.ts` |
| `src/lib/reboot-parser.ts` |
| `src/lib/players/getPlayerScorecard.ts` |
| `src/pages/AdminRebootAnalysis.tsx` (inline interface) |

### 🟡 Coaching Language / Leak Explanations (2 implementations)
| Location | What It Does |
|----------|-------------|
| `src/lib/coachingLanguage.ts` | `weakestLinkExplanations` map + trend language |
| `src/lib/training-translation.ts` | Training translation utilities (body part names, analysis confidence) |

### 🟡 Reboot Polling/Sync (5+ overlapping functions)
| Function |
|----------|
| `sync-reboot-sessions` |
| `poll-reboot-sessions` |
| `reboot-motion-polling` |
| `reboot-poll-status` |
| `reboot-polling-sync` |
| `fetch-reboot-sessions` |

### 🟡 Video Upload Paths (3+ paths)
| Location |
|----------|
| `upload-swing` (edge function) |
| `upload-video` (edge function) |
| `upload-to-reboot` (edge function) |
| `reboot-upload-video` (edge function) |
| `src/components/VideoUploader.tsx` |
| `src/components/video/VideoUploadWithGumlet.tsx` |
| `src/components/upload/*` |

### 🟡 Player Creation/Linking (3+ paths)
| Location |
|----------|
| `create-reboot-athlete` edge function |
| `reboot-create-player` edge function |
| `create-reference-athlete` edge function |
| `backfill_players_from_profiles()` DB function |
| `ensure_player_linked()` DB function |

### 🟡 Drill Recommendation Logic (2+ paths)
| Location |
|----------|
| `src/lib/sensor-analysis/drills.ts` | Client-side drill library + recommendations |
| `src/lib/coachingLanguage.ts` | Hardcoded drill names per leak type |
| `prescribe-drills` edge function | Server-side prescription |
| `drill_prescriptions` table | Database-driven prescriptions |

---

## 5. Feature Families

### 🏗️ SCORING ENGINE
- **Tables**: `player_sessions`, `sessions`, `swings`, `athlete_krs_models`
- **Edge Functions**: `calculate-4b-scores`, `backfill-4b-scores`, `compute-4b-from-csv`, `calibrate-athlete-model`, `score-monitor`
- **Client Libs**: `fourBScoring.ts`, `fourb-composite.ts`, `kesp-engine.ts`, `sensor-analysis/four-b-scoring.ts`, `reboot-parser.ts`, `4b-scores-api.ts`
- **Components**: `FourBScoreCard`, `FourBScoreboardExpanded`, `Interactive4BTiles`, `ScoreCircle`, `ScoreGauge`, `ScoutGaugeGrid`
- **Pages**: PlayerDashboard4B, PlayerProgression, SwingReport

### 🔬 REBOOT MOTION
- **Tables**: `reboot_uploads`, `reboot_sessions`, `player_sessions`
- **Edge Functions**: `sync-reboot-sessions`, `fetch-reboot-*`, `poll-reboot-*`, `reboot-*`, `manual-reboot-upload`, `process-reboot-session`, `analyze-reboot-biomechanics`
- **Client Libs**: `reboot/`, `reboot-parser.ts`
- **Components**: `PlayerRebootMotionTab`, `RebootSessionDetailDrawer`, `RebootConnectionStatus`, `ManualRebootUpload`, `PendingRebootQueue`, `RebootPlayerImportModal`, `AdminRescorePanel`
- **Pages**: AdminRebootAnalysis

### 📹 2D VIDEO ANALYSIS
- **Tables**: `video_2d_sessions`, `swing_leaks`, `video_swing_events`, `video_swing_sessions`
- **Edge Functions**: `analyze-video-2d`, `analyze-swing-2d`, `analyze-video-swing-session`, `mediapipe-analyze`, `sam3-segment`
- **Client Libs**: `video-analysis/`, `video-types.ts`
- **Hooks**: `useDualPathAnalysis`, `useAnalyzeVideoSwingSession`, `useSAM3Segment`
- **Components**: `Video2DAnalysisCard`, `VideoRecorder`, `video-analyzer/`
- **Pages**: SwingUpload (Analyze), Analyze

### ⚾ DIAMOND KINETICS
- **Tables**: `dk_accounts`, `dk_sync_log`, `dk_token_cache`, `capture_sessions`, `captured_swings`, `sensor_sessions`, `ghost_sessions`
- **Edge Functions**: `dk-*` (10 functions), `recover-ghost-session`
- **Client Libs**: `integrations/diamond-kinetics/`
- **Hooks**: `useDKAccount`
- **Components**: `DKConnectionBadge`, `DKFieldsSection`, `PlayerDKSessionsTab`, `PlayerSwings`, `PlayerSwingDetail`, `PlayerGhostLab`, `PlayerGhostRecovery`
- **Pages**: ConnectDK, PlayerSwings, PlayerSwingDetail, PlayerGhostLab, PlayerGhostRecovery

### 📊 PLAYER PROGRESSION
- **Tables**: `player_sessions` (scored_at, scoring_version, weakest_link, etc.)
- **Edge Functions**: `backfill-4b-scores`, `player-trendboard`
- **Client Libs**: `coachingLanguage.ts`, `players/getPlayerScorecard.ts`
- **Hooks**: `usePlayerScorecard`
- **Components**: `PlayerProgressionDashboard` (admin), `PlayerProgression` (player)
- **Pages**: PlayerProgression

### 🎯 DRILL INTEL & PRESCRIPTIONS
- **Tables**: `drills`, `drill_completions`, `drill_prescriptions`, `drill_videos`, `player_drill_assignments`, `programs`, `player_programs`
- **Edge Functions**: `prescribe-drills`
- **Client Libs**: `sensor-analysis/drills.ts`, `drill-library-data.ts`, `drill-library-types.ts`, `coachingLanguage.ts`
- **Components**: `DrillIntelTab`, `DrillSessionBanner`, `PlayerDrills`
- **Pages**: Drills, DrillDetail, PlayerDrills

### 🏟️ LAUNCH MONITOR / HITTRAX
- **Tables**: `hittrax_sessions`, `launch_monitor_sessions`, `batted_ball_events`
- **Client Libs**: `hittrax-parser.ts`, `launch-monitor-parser.ts`, `launch-monitor-metrics.ts`, `ballFlightPredictor.ts`
- **Components**: `HitTraxSessionDetail`, `HitTraxUploadModal`, `LaunchMonitorSessionDetail`, `LaunchMonitorBoxScore`
- **Pages**: AdminHitTraxImport

### 🤖 COACH RICK AI
- **Tables**: `clawdbot_knowledge`, `clawdbot_cues`, `clawdbot_scenarios`, `clawdbot_ratings`, `coach_rick_rules`, `chat_logs`
- **Edge Functions**: `coach-rick-ai-chat`, `rickbot-command`, `rickbot-transcribe`, `ask-the-lab`, `generate-coach-message`, `get-player-context`, `process-coach-rick-video`
- **Hooks**: `useRickBot`, `useCoachChat`
- **Components**: `CoachRickChat`, `CoachRickWidget`, `AdminLabChat`, `AskTheLabChat`, `WeeklyCheckinChat`, `rickbot/`
- **Pages**: Rick, CoachChat, CoachRickAIAdmin, CoachRickAITestChat, CoachRickAIVideos, CueBankManager, KnowledgeBaseEditor, ScenarioTrainer

### 📱 COMMUNICATION
- **Tables**: `web_messages`, `coach_conversations`, `communication_logs`, `chat_logs`, `blocked_numbers`, `invites`
- **Edge Functions**: `send-sms`, `send-coach-rick-sms`, `coach-rick-sms`, `schedule-sms`, `cancel-sms`, `process-sms-triggers`, `session-complete-sms`, `twilio-webhook`, `send-invite`, `send-beta-invite`, `send-player-email`, `broadcast-email`, `admin-messages`, `admin-sms`
- **Components**: `PlayerCommunicationTab`, `PlayerCommunicationTabNew`
- **Pages**: AdminMessages, AdminSMS, AdminBroadcast, AdminInvites, PlayerMessages

### 📰 CONTENT ENGINE
- **Tables**: `content_items`, `content_outputs`, `content_topics`
- **Edge Functions**: `process-content`, `generate-content-suggestion`, `suggest-trending-topics`, `post-to-social`, `analyze-video-script`, `auto-tag-video`, `transcribe-video`
- **Components**: `content-engine/`, `SocialPostGenerator`
- **Pages**: AdminContentEngine, VideoScriptAnalyzer

### 🔎 SCOUTING / PROSPECT LAB
- **Tables**: `final_research_briefs`
- **Edge Functions**: `prospect-research-pipeline`, `research-player`, `scrape-player-profile`, `baseball-savant-lookup`, `fangraphs-lookup`
- **Components**: `PlayerResearchModal`
- **Pages**: AdminProspectLab

### 📚 KNOWLEDGE VAULT
- **Tables**: `knowledge_documents`, `drill_videos`
- **Edge Functions**: `search-vault`, `process-vault-document`, `upload-to-gumlet`, `gumlet-webhook`, `import-onform-video`
- **Pages**: AdminVault, AdminCoachRickVault, AdminKnowledgeBase, AdminLibrary, AdminVideos, Library

### 🎮 GAMIFICATION
- **Tables**: `weekly_challenges`, `challenge_entries`, `xp_log`, `game_weekly_reports`
- **Client Libs**: `gamification/` (challenges.ts, gamification-engine.ts, xp.ts, kinetic-fingerprint.ts)
- **DB Functions**: `award_xp`, `calculate_player_level`
- **Pages**: PlayerWeeklyCheckin

### 💳 PAYMENTS
- **Edge Functions**: `create-checkout`, `create-assessment-checkout`, `create-coaching-checkout`, `create-inner-circle-checkout`, `create-krs-assessment-checkout`, `create-subscription-checkout`, `stripe-webhook`
- **Pages**: Pricing, Assessment, InnerCircle

### 🛡️ ADMIN CORE
- **Components**: `AdminHeader`, `AdminMobileLayout`, `MobileBottomNav`, `FloatingActionButton`, `DashboardWidgets`, `ActivityFeed`
- **Tabs (player-profile/)**: PlayerOverviewTab, PlayerScoresTab, PlayerScoresTabNew, PlayerDataTab, PlayerActivityTab, PlayerScheduleTab, PlayerDrillsTab, PlayerCommunicationTab, PlayerCommunicationTabNew, PlayerTransferTab, PlayerVideoTab, PlayerRebootMotionTab, PlayerDKSessionsTab, KineticSequenceTab, StabilityTab, DiagnosticLabHeader
- **Pages**: AdminDashboard, AdminPlayers, AdminPlayerProfile

---

## 6. Key Observations for v2

1. **Scoring engine fragmentation** is the #1 risk — 5+ implementations of 4B scoring with potentially divergent formulas. Should consolidate to a single server-side edge function (`calculate-4b-scores`) and remove all client-side scoring.

2. **Reboot polling has 5+ overlapping edge functions** — consolidate to one `sync-reboot` function with modes (poll, full-sync, single-session).

3. **~115 edge functions** is extremely high. Many are thin wrappers or near-duplicates. Candidates for consolidation: all `reboot-*` into 2-3, all `dk-*` into 2-3, all `coach-*` SMS into 1, all `create-*-checkout` into 1 parameterized function.

4. **Type duplication** (`FourBScores` defined 5 times) creates silent drift. Should be a single shared type imported everywhere.

5. **Player profile / player table split** creates ongoing confusion with ID resolution (`player_profiles.id` vs `players.id`). Many components have to resolve both.

6. **Admin player-profile tabs** (36 files in `components/admin/player-profile/`) could be grouped into sub-modules: Scores, Reboot, DK, Communication, Diagnostics.

7. **72 routes** — some appear unused or redundant (`/index`, `/session` vs `/session/:id`, `/analysis` vs `/analyze`).
