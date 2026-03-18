import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";

// Core pages
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Athletes from "./pages/Athletes";
import AthleteDetail from "./pages/AthleteDetail";
import Upload from "./pages/Upload";
import SwingUpload from "./pages/SwingUpload";
import SessionView from "./pages/SessionView";
import SwingReport from "./pages/SwingReport";
import Dashboard from "./pages/Dashboard";

// Auth & legal
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Pricing from "./pages/Pricing";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";

// Public pages
import About from "./pages/About";
import Coaching from "./pages/Coaching";
import Diagnostic from "./pages/Diagnostic";
import Diagrams from "./pages/Diagrams";
import Drills from "./pages/Drills";
import DrillDetail from "./pages/DrillDetail";
import Library from "./pages/Library";
import Analyze from "./pages/Analyze";
import Assessment from "./pages/Assessment";
import Beta from "./pages/Beta";
import Apply from "./pages/Apply";
import Consent from "./pages/Consent";
import ConnectDK from "./pages/ConnectDK";
import FreeDiagnosticReport from "./pages/FreeDiagnosticReport";
import InnerCircle from "./pages/InnerCircle";
import MyData from "./pages/MyData";
import Results from "./pages/Results";
import Session from "./pages/Session";
import SocialClips from "./pages/SocialClips";
import ReportWireframes from "./pages/ReportWireframes";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminPlayers from "./pages/AdminPlayers";
import AdminPlayerProfile from "./pages/AdminPlayerProfile";
import AdminAnalyzer from "./pages/AdminAnalyzer";
import AdminSessionView from "./pages/AdminSessionView";
import AdminNewSession from "./pages/AdminNewSession";
import AdminSessionSetup from "./pages/AdminSessionSetup";
import AdminSwingSessionUpload from "./pages/AdminSwingSessionUpload";
import AdminBroadcast from "./pages/AdminBroadcast";
import AdminMessages from "./pages/AdminMessages";
import AdminSMS from "./pages/AdminSMS";
import AdminInvites from "./pages/AdminInvites";
import AdminLibrary from "./pages/AdminLibrary";
import AdminVideos from "./pages/AdminVideos";
import AdminVault from "./pages/AdminVault";
import AdminCoachRickVault from "./pages/AdminCoachRickVault";
import AdminKnowledgeBase from "./pages/AdminKnowledgeBase";
import AdminContentEngine from "./pages/AdminContentEngine";
import AdminProspectLab from "./pages/AdminProspectLab";
import AdminRebootAnalysis from "./pages/AdminRebootAnalysis";
import AdminReportQueue from "./pages/AdminReportQueue";
import AdminValidationQueue from "./pages/AdminValidationQueue";
import AdminHitTraxImport from "./pages/AdminHitTraxImport";
import AdminImportKommodo from "./pages/AdminImportKommodo";
import CoachRickAIAdmin from "./pages/admin/CoachRickAIAdmin";
import CoachRickAITestChat from "./pages/admin/CoachRickAITestChat";
import CoachRickAIVideos from "./pages/admin/CoachRickAIVideos";
import CueBankManager from "./pages/admin/CueBankManager";
import KnowledgeBaseEditor from "./pages/admin/KnowledgeBaseEditor";
import ScenarioTrainer from "./pages/admin/ScenarioTrainer";
import VideoScriptAnalyzer from "./pages/admin/VideoScriptAnalyzer";
import AdminSeedSwingData from "./pages/AdminSeedSwingData";

// Player pages (v2 rebuild)
import PlayerHomeDashboard from "./pages/player-v2/PlayerHomeDashboard";
import PlayerMyData from "./pages/player-v2/PlayerMyData";
import PlayerSessionPage from "./pages/player-v2/PlayerSessionPage";
import PlayerProgressPage from "./pages/player-v2/PlayerProgressPage";
import PlayerMessagesPage from "./pages/player-v2/PlayerMessagesPage";
import PlayerProfilePage from "./pages/player-v2/PlayerProfilePage";

// RickBot
import Rick from "./pages/Rick";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/player/progress" element={<PlayerProgressPage />} />
            <Route path="/player/messages" element={<PlayerMessagesPage />} />
            <Route path="/player/profile" element={<PlayerProfilePage />} />
            {/* Legacy redirects — coach-chat and coach both go to messages */}
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
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
