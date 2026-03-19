import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";

// Lazy-loaded pages
const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Athletes = lazy(() => import("./pages/Athletes"));
const AthleteDetail = lazy(() => import("./pages/AthleteDetail"));
const Upload = lazy(() => import("./pages/Upload"));
const SwingUpload = lazy(() => import("./pages/SwingUpload"));
const SessionView = lazy(() => import("./pages/SessionView"));
const SwingReport = lazy(() => import("./pages/SwingReport"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Welcome = lazy(() => import("./pages/Welcome"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const Coaching = lazy(() => import("./pages/Coaching"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const Diagrams = lazy(() => import("./pages/Diagrams"));
const Drills = lazy(() => import("./pages/Drills"));
const DrillDetail = lazy(() => import("./pages/DrillDetail"));
const Library = lazy(() => import("./pages/Library"));
const Analyze = lazy(() => import("./pages/Analyze"));
const Assessment = lazy(() => import("./pages/Assessment"));
const Beta = lazy(() => import("./pages/Beta"));
const Apply = lazy(() => import("./pages/Apply"));
const Consent = lazy(() => import("./pages/Consent"));
const ConnectDK = lazy(() => import("./pages/ConnectDK"));
const FreeDiagnosticReport = lazy(() => import("./pages/FreeDiagnosticReport"));
const InnerCircle = lazy(() => import("./pages/InnerCircle"));
const MyData = lazy(() => import("./pages/MyData"));
const Results = lazy(() => import("./pages/Results"));
const Session = lazy(() => import("./pages/Session"));
const SocialClips = lazy(() => import("./pages/SocialClips"));
const ReportWireframes = lazy(() => import("./pages/ReportWireframes"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminPlayers = lazy(() => import("./pages/AdminPlayers"));
const AdminPlayerProfile = lazy(() => import("./pages/AdminPlayerProfile"));
const AdminAnalyzer = lazy(() => import("./pages/AdminAnalyzer"));
const AdminSessionView = lazy(() => import("./pages/AdminSessionView"));
const AdminNewSession = lazy(() => import("./pages/AdminNewSession"));
const AdminSessionSetup = lazy(() => import("./pages/AdminSessionSetup"));
const AdminSwingSessionUpload = lazy(() => import("./pages/AdminSwingSessionUpload"));
const AdminBroadcast = lazy(() => import("./pages/AdminBroadcast"));
const AdminMessages = lazy(() => import("./pages/AdminMessages"));
const AdminSMS = lazy(() => import("./pages/AdminSMS"));
const AdminInvites = lazy(() => import("./pages/AdminInvites"));
const AdminLibrary = lazy(() => import("./pages/AdminLibrary"));
const AdminVideos = lazy(() => import("./pages/AdminVideos"));
const AdminVault = lazy(() => import("./pages/AdminVault"));
const AdminCoachRickVault = lazy(() => import("./pages/AdminCoachRickVault"));
const AdminKnowledgeBase = lazy(() => import("./pages/AdminKnowledgeBase"));
const AdminContentEngine = lazy(() => import("./pages/AdminContentEngine"));
const AdminProspectLab = lazy(() => import("./pages/AdminProspectLab"));
const AdminRebootAnalysis = lazy(() => import("./pages/AdminRebootAnalysis"));
const AdminReportQueue = lazy(() => import("./pages/AdminReportQueue"));
const AdminValidationQueue = lazy(() => import("./pages/AdminValidationQueue"));
const AdminHitTraxImport = lazy(() => import("./pages/AdminHitTraxImport"));
const AdminImportKommodo = lazy(() => import("./pages/AdminImportKommodo"));
const CoachRickAIAdmin = lazy(() => import("./pages/admin/CoachRickAIAdmin"));
const CoachRickAITestChat = lazy(() => import("./pages/admin/CoachRickAITestChat"));
const CoachRickAIVideos = lazy(() => import("./pages/admin/CoachRickAIVideos"));
const CueBankManager = lazy(() => import("./pages/admin/CueBankManager"));
const KnowledgeBaseEditor = lazy(() => import("./pages/admin/KnowledgeBaseEditor"));
const ScenarioTrainer = lazy(() => import("./pages/admin/ScenarioTrainer"));
const VideoScriptAnalyzer = lazy(() => import("./pages/admin/VideoScriptAnalyzer"));
const AdminSeedSwingData = lazy(() => import("./pages/AdminSeedSwingData"));
const AdminCalibration = lazy(() => import("./pages/AdminCalibration"));

// Player pages
const PlayerHomeDashboard = lazy(() => import("./pages/player-v2/PlayerHomeDashboard"));
const PlayerMyData = lazy(() => import("./pages/player-v2/PlayerMyData"));
const PlayerSessionPage = lazy(() => import("./pages/player-v2/PlayerSessionPage"));
const PlayerNewSession = lazy(() => import("./pages/player/PlayerNewSession"));
const PlayerProgressPage = lazy(() => import("./pages/player-v2/PlayerProgressPage"));
const PlayerMessagesPage = lazy(() => import("./pages/player-v2/PlayerMessagesPage"));
const PlayerProfilePage = lazy(() => import("./pages/player-v2/PlayerProfilePage"));
const PlayerSessionDetail = lazy(() => import("./pages/player-v2/PlayerSessionDetail"));

// RickBot
const Rick = lazy(() => import("./pages/Rick"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public landing */}
              <Route path="/" element={<Landing />} />
              <Route path="/index" element={<Index />} />
              <Route path="/about" element={<About />} />

              {/* Core app routes */}
              <Route path="/athletes" element={<Athletes />} />
              <Route path="/athletes/:id" element={<AthleteDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/analyze" element={<SwingUpload />} />
              <Route path="/analysis" element={<Analyze />} />
              <Route path="/session/:sessionId" element={<SessionView />} />
              <Route path="/sessions/:sessionId" element={<SessionView />} />
              <Route path="/session" element={<Session />} />
              <Route path="/report/:sessionId" element={<SwingReport />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/diagnostic" element={<Diagnostic />} />
              <Route path="/diagrams" element={<Diagrams />} />
              <Route path="/drills" element={<Drills />} />
              <Route path="/drills/:slug" element={<DrillDetail />} />
              <Route path="/library" element={<Library />} />
              <Route path="/coaching" element={<Coaching />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/beta" element={<Beta />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/consent" element={<Consent />} />
              <Route path="/connect-dk" element={<ConnectDK />} />
              <Route path="/free-diagnostic" element={<FreeDiagnosticReport />} />
              <Route path="/inner-circle" element={<InnerCircle />} />
              <Route path="/my-data" element={<MyData />} />
              <Route path="/results" element={<Results />} />
              <Route path="/social-clips" element={<SocialClips />} />
              <Route path="/report-wireframes" element={<ReportWireframes />} />

              {/* Auth */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Legal & info */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/welcome" element={<Welcome />} />

              {/* Player portal (v2 rebuild) */}
              <Route path="/player" element={<PlayerHomeDashboard />} />
              <Route path="/player/home" element={<PlayerHomeDashboard />} />
              <Route path="/player/data" element={<PlayerMyData />} />
              <Route path="/player/session" element={<PlayerSessionPage />} />
              <Route path="/player/session/new" element={<PlayerNewSession />} />
              <Route path="/player/session/:sessionId" element={<PlayerSessionDetail />} />
              <Route path="/player/progress" element={<PlayerProgressPage />} />
              <Route path="/player/messages" element={<PlayerMessagesPage />} />
              <Route path="/player/profile" element={<PlayerProfilePage />} />
              <Route path="/player/coach-chat" element={<PlayerMessagesPage />} />
              <Route path="/player/coach" element={<PlayerMessagesPage />} />

              {/* RickBot */}
              <Route path="/rick" element={<ProtectedAdminRoute><Rick /></ProtectedAdminRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
              <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
              <Route path="/admin/players" element={<ProtectedAdminRoute><AdminPlayers /></ProtectedAdminRoute>} />
              <Route path="/admin/players/:id" element={<ProtectedAdminRoute><AdminPlayerProfile /></ProtectedAdminRoute>} />
              <Route path="/admin/analyzer" element={<ProtectedAdminRoute><AdminAnalyzer /></ProtectedAdminRoute>} />
              <Route path="/admin/session/:id" element={<ProtectedAdminRoute><AdminSessionView /></ProtectedAdminRoute>} />
              <Route path="/admin/new-session" element={<ProtectedAdminRoute><AdminNewSession /></ProtectedAdminRoute>} />
              <Route path="/admin/session-setup" element={<ProtectedAdminRoute><AdminSessionSetup /></ProtectedAdminRoute>} />
              <Route path="/admin/swing-upload" element={<ProtectedAdminRoute><AdminSwingSessionUpload /></ProtectedAdminRoute>} />
              <Route path="/admin/broadcast" element={<ProtectedAdminRoute><AdminBroadcast /></ProtectedAdminRoute>} />
              <Route path="/admin/messages" element={<ProtectedAdminRoute><AdminMessages /></ProtectedAdminRoute>} />
              <Route path="/admin/sms" element={<ProtectedAdminRoute><AdminSMS /></ProtectedAdminRoute>} />
              <Route path="/admin/invites" element={<ProtectedAdminRoute><AdminInvites /></ProtectedAdminRoute>} />
              <Route path="/admin/library" element={<ProtectedAdminRoute><AdminLibrary /></ProtectedAdminRoute>} />
              <Route path="/admin/videos" element={<ProtectedAdminRoute><AdminVideos /></ProtectedAdminRoute>} />
              <Route path="/admin/calibration" element={<ProtectedAdminRoute><AdminCalibration /></ProtectedAdminRoute>} />
              <Route path="/admin/vault" element={<ProtectedAdminRoute><AdminVault /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-vault" element={<ProtectedAdminRoute><AdminCoachRickVault /></ProtectedAdminRoute>} />
              <Route path="/admin/knowledge-base" element={<ProtectedAdminRoute><AdminKnowledgeBase /></ProtectedAdminRoute>} />
              <Route path="/admin/content-engine" element={<ProtectedAdminRoute><AdminContentEngine /></ProtectedAdminRoute>} />
              <Route path="/admin/prospect-lab" element={<ProtectedAdminRoute><AdminProspectLab /></ProtectedAdminRoute>} />
              <Route path="/admin/reboot-analysis" element={<ProtectedAdminRoute><AdminRebootAnalysis /></ProtectedAdminRoute>} />
              <Route path="/admin/report-queue" element={<ProtectedAdminRoute><AdminReportQueue /></ProtectedAdminRoute>} />
              <Route path="/admin/validation-queue" element={<ProtectedAdminRoute><AdminValidationQueue /></ProtectedAdminRoute>} />
              <Route path="/admin/hittrax-import" element={<ProtectedAdminRoute><AdminHitTraxImport /></ProtectedAdminRoute>} />
              <Route path="/admin/import-kommodo" element={<ProtectedAdminRoute><AdminImportKommodo /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai" element={<ProtectedAdminRoute><CoachRickAIAdmin /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai/test" element={<ProtectedAdminRoute><CoachRickAITestChat /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai/videos" element={<ProtectedAdminRoute><CoachRickAIVideos /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai/knowledge" element={<ProtectedAdminRoute><KnowledgeBaseEditor /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai/scenarios" element={<ProtectedAdminRoute><ScenarioTrainer /></ProtectedAdminRoute>} />
              <Route path="/admin/coach-rick-ai/cues" element={<ProtectedAdminRoute><CueBankManager /></ProtectedAdminRoute>} />
              <Route path="/admin/cue-bank" element={<ProtectedAdminRoute><CueBankManager /></ProtectedAdminRoute>} />
              <Route path="/admin/knowledge-editor" element={<ProtectedAdminRoute><KnowledgeBaseEditor /></ProtectedAdminRoute>} />
              <Route path="/admin/scenario-trainer" element={<ProtectedAdminRoute><ScenarioTrainer /></ProtectedAdminRoute>} />
              <Route path="/admin/video-script-analyzer" element={<ProtectedAdminRoute><VideoScriptAnalyzer /></ProtectedAdminRoute>} />
              <Route path="/admin/seed-swing-data" element={<ProtectedAdminRoute><AdminSeedSwingData /></ProtectedAdminRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
