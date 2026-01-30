import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";
import { CoachRickWidget } from "@/components/CoachRickWidget";
import { PlayerLayout } from "@/components/player/PlayerLayout";

// Public pages
import Index from "./pages/Index";
import Analyze from "./pages/Analyze";
import About from "./pages/About";
import InnerCircle from "./pages/InnerCircle";
import Assessment from "./pages/Assessment";
import Library from "./pages/Library";
import Results from "./pages/Results";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Beta from "./pages/Beta";
import NotFound from "./pages/NotFound";
import SocialClips from "./pages/SocialClips";
import Pricing from "./pages/Pricing";
import Apply from "./pages/Apply";
import Diagnostic from "./pages/Diagnostic";
import Coaching from "./pages/Coaching";
import FreeDiagnosticReport from "./pages/FreeDiagnosticReport";
import SwingReport from "./pages/SwingReport";
import ReportWireframes from "./pages/ReportWireframes";
import MyData from "./pages/MyData";
import Dashboard from "./pages/Dashboard";
import Drills from "./pages/Drills";
import DrillDetail from "./pages/DrillDetail";
import Consent from "./pages/Consent";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Session from "./pages/Session";
import ConnectDK from "./pages/ConnectDK";
import Rick from "./pages/Rick";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminMessages from "./pages/AdminMessages";
import AdminVideos from "./pages/AdminVideos";
import AdminAnalyzer from "./pages/AdminAnalyzer";
import AdminNewSession from "./pages/AdminNewSession";
import AdminSwingSessionUpload from "./pages/AdminSwingSessionUpload";
import AdminSessionView from "./pages/AdminSessionView";
import AdminPlayers from "./pages/AdminPlayers";
import AdminPlayerProfile from "./pages/AdminPlayerProfile";
import AdminImportKommodo from "./pages/AdminImportKommodo";
import AdminSMS from "./pages/AdminSMS";
import AdminRebootAnalysis from "./pages/AdminRebootAnalysis";
import AdminHitTraxImport from "./pages/AdminHitTraxImport";
import AdminLibrary from "./pages/AdminLibrary";
import AdminInvites from "./pages/AdminInvites";
import AdminValidationQueue from "./pages/AdminValidationQueue";
import AdminReportQueue from "./pages/AdminReportQueue";
import AdminProspectLab from "./pages/AdminProspectLab";
import AdminSessionSetup from "./pages/AdminSessionSetup";
import AdminVault from "./pages/AdminVault";
import AdminCoachRickVault from "./pages/AdminCoachRickVault";
import AdminBroadcast from "./pages/AdminBroadcast";
import AdminContentEngine from "./pages/AdminContentEngine";
import AdminKnowledgeBase from "./pages/AdminKnowledgeBase";
import CoachRickAIAdmin from "./pages/admin/CoachRickAIAdmin";
import KnowledgeBaseEditor from "./pages/admin/KnowledgeBaseEditor";
import ScenarioTrainer from "./pages/admin/ScenarioTrainer";
import CueBankManager from "./pages/admin/CueBankManager";
import CoachRickAITestChat from "./pages/admin/CoachRickAITestChat";
import CoachRickAIVideos from "./pages/admin/CoachRickAIVideos";
import VideoScriptAnalyzer from "./pages/admin/VideoScriptAnalyzer";

// Player pages
import PlayerDashboard4B from "./pages/player/PlayerDashboard4B";
import PlayerData from "./pages/player/PlayerData";
import PlayerDrills from "./pages/player/PlayerDrills";
import PlayerMessages from "./pages/player/PlayerMessages";
import PlayerProfile from "./pages/player/PlayerProfile";
import PlayerNewSession from "./pages/player/PlayerNewSession";
import PlayerWeeklyCheckin from "./pages/player/PlayerWeeklyCheckin";
import PlayerGhostLab from "./pages/player/PlayerGhostLab";
import PlayerGhostRecovery from "./pages/player/PlayerGhostRecovery";
import CoachChat from "./pages/player/CoachChat";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AnalysisProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CoachRickWidget />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/analyze" element={<Analyze />} />
              <Route path="/about" element={<About />} />
              <Route path="/inner-circle" element={<InnerCircle />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/library" element={<Library />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/beta" element={<Beta />} />
              <Route path="/social-clips" element={<SocialClips />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/diagnostic" element={<Diagnostic />} />
              <Route path="/diagnostic/report/:sessionId?" element={<FreeDiagnosticReport />} />
              <Route path="/coaching" element={<Coaching />} />
              <Route path="/report/:sessionId" element={<SwingReport />} />
              <Route path="/wireframes/report" element={<ReportWireframes />} />
              <Route path="/my-data" element={<MyData />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/drills" element={<Drills />} />
              <Route path="/drills/:slug" element={<DrillDetail />} />
              <Route path="/consent" element={<Consent />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/session" element={<Session />} />
              <Route path="/connect-dk" element={<ConnectDK />} />
              <Route path="/rick" element={
                <ProtectedAdminRoute>
                  <Rick />
                </ProtectedAdminRoute>
              } />


              {/* Player Portal Routes - 4B First Dashboard */}
              <Route path="/player" element={<PlayerLayout />}>
                <Route index element={<PlayerDashboard4B />} />
                <Route path="data" element={<PlayerData />} />
                <Route path="drills" element={<PlayerDrills />} />
                <Route path="messages" element={<PlayerMessages />} />
                <Route path="profile" element={<PlayerProfile />} />
                <Route path="new-session" element={<PlayerNewSession />} />
                <Route path="weekly-checkin" element={<PlayerWeeklyCheckin />} />
                <Route path="diagnostic/:sessionId?" element={<FreeDiagnosticReport />} />
                <Route path="ghost-lab" element={<PlayerGhostLab />} />
                <Route path="ghost-recovery" element={<PlayerGhostRecovery />} />
                <Route path="coach-chat" element={<CoachChat />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedAdminRoute>
                  <AdminDashboard />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/messages" element={
                <ProtectedAdminRoute>
                  <AdminMessages />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/videos" element={
                <ProtectedAdminRoute>
                  <AdminVideos />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/analyzer" element={
                <ProtectedAdminRoute>
                  <AdminAnalyzer />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/new-session" element={
                <ProtectedAdminRoute>
                  <AdminNewSession />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/sessions/new" element={
                <ProtectedAdminRoute>
                  <AdminSwingSessionUpload />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/sessions/:id" element={
                <ProtectedAdminRoute>
                  <AdminSessionView />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/import-kommodo" element={
                <ProtectedAdminRoute>
                  <AdminImportKommodo />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/players" element={
                <ProtectedAdminRoute>
                  <AdminPlayers />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/players/:id" element={
                <ProtectedAdminRoute>
                  <AdminPlayerProfile />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/sms" element={
                <ProtectedAdminRoute>
                  <AdminSMS />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/reboot-analysis" element={
                <ProtectedAdminRoute>
                  <AdminRebootAnalysis />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/hittrax-import" element={
                <ProtectedAdminRoute>
                  <AdminHitTraxImport />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/library" element={
                <ProtectedAdminRoute>
                  <AdminLibrary />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/invites" element={
                <ProtectedAdminRoute>
                  <AdminInvites />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/validation-queue" element={
                <ProtectedAdminRoute>
                  <AdminValidationQueue />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/report-queue" element={
                <ProtectedAdminRoute>
                  <AdminReportQueue />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/prospect-lab" element={
                <ProtectedAdminRoute>
                  <AdminProspectLab />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/session-setup" element={
                <ProtectedAdminRoute>
                  <AdminSessionSetup />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/vault" element={
                <ProtectedAdminRoute>
                  <AdminVault />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-vault" element={
                <ProtectedAdminRoute>
                  <AdminCoachRickVault />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/broadcast" element={
                <ProtectedAdminRoute>
                  <AdminBroadcast />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/content-engine" element={
                <ProtectedAdminRoute>
                  <AdminContentEngine />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/knowledge-base" element={
                <ProtectedAdminRoute>
                  <AdminKnowledgeBase />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai" element={
                <ProtectedAdminRoute>
                  <CoachRickAIAdmin />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai/knowledge" element={
                <ProtectedAdminRoute>
                  <KnowledgeBaseEditor />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai/scenarios" element={
                <ProtectedAdminRoute>
                  <ScenarioTrainer />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai/cues" element={
                <ProtectedAdminRoute>
                  <CueBankManager />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai/test" element={
                <ProtectedAdminRoute>
                  <CoachRickAITestChat />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/coach-rick-ai/videos" element={
                <ProtectedAdminRoute>
                  <CoachRickAIVideos />
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/script-analyzer" element={
                <ProtectedAdminRoute>
                  <VideoScriptAnalyzer />
                </ProtectedAdminRoute>
              } />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AnalysisProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
