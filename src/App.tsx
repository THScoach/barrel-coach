import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";
import { CoachRickWidget } from "@/components/CoachRickWidget";

// Core pages
import Athletes from "./pages/Athletes";
import AthleteDetail from "./pages/AthleteDetail";
import Upload from "./pages/Upload";
import SessionView from "./pages/SessionView";

// Auth & legal
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

// Admin tool (Coach Rick's RickBot)
import Rick from "./pages/Rick";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminPlayers from "./pages/AdminPlayers";
import AdminPlayerProfile from "./pages/AdminPlayerProfile";
import AdminValidationQueue from "./pages/AdminValidationQueue";
import AdminInvites from "./pages/AdminInvites";
import AdminLibrary from "./pages/AdminLibrary";
import AdminVault from "./pages/AdminVault";
import AdminKnowledgeBase from "./pages/AdminKnowledgeBase";
import AdminMessages from "./pages/AdminMessages";
import AdminReportQueue from "./pages/AdminReportQueue";
import AdminVideos from "./pages/AdminVideos";
import AdminSessionView from "./pages/AdminSessionView";
import AdminBroadcast from "./pages/AdminBroadcast";
import AdminSMS from "./pages/AdminSMS";
import AdminContentEngine from "./pages/AdminContentEngine";
import AdminProspectLab from "./pages/AdminProspectLab";
import AdminHitTraxImport from "./pages/AdminHitTraxImport";
import AdminImportKommodo from "./pages/AdminImportKommodo";
import AdminNewSession from "./pages/AdminNewSession";
import AdminSessionSetup from "./pages/AdminSessionSetup";
import AdminSwingSessionUpload from "./pages/AdminSwingSessionUpload";
import AdminRebootAnalysis from "./pages/AdminRebootAnalysis";
import AdminAnalyzer from "./pages/AdminAnalyzer";
import AdminCoachRickVault from "./pages/AdminCoachRickVault";

// Admin sub-pages (Coach Rick AI)
import CoachRickAIAdmin from "./pages/admin/CoachRickAIAdmin";
import CoachRickAITestChat from "./pages/admin/CoachRickAITestChat";
import CoachRickAIVideos from "./pages/admin/CoachRickAIVideos";
import CueBankManager from "./pages/admin/CueBankManager";
import KnowledgeBaseEditor from "./pages/admin/KnowledgeBaseEditor";
import ScenarioTrainer from "./pages/admin/ScenarioTrainer";
import VideoScriptAnalyzer from "./pages/admin/VideoScriptAnalyzer";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedAdminRoute>{children}</ProtectedAdminRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CoachRickWidget />
          <Routes>
            {/* Core app routes */}
            <Route path="/" element={<Athletes />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteDetail />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/sessions/:sessionId" element={<SessionView />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />

            {/* Legal */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* RickBot PWA */}
            <Route path="/rick" element={<AdminRoute><Rick /></AdminRoute>} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/players" element={<AdminRoute><AdminPlayers /></AdminRoute>} />
            <Route path="/admin/players/new" element={<AdminRoute><AdminPlayers /></AdminRoute>} />
            <Route path="/admin/players/:id" element={<AdminRoute><AdminPlayerProfile /></AdminRoute>} />
            <Route path="/admin/validation-queue" element={<AdminRoute><AdminValidationQueue /></AdminRoute>} />
            <Route path="/admin/invites" element={<AdminRoute><AdminInvites /></AdminRoute>} />
            <Route path="/admin/library" element={<AdminRoute><AdminLibrary /></AdminRoute>} />
            <Route path="/admin/vault" element={<AdminRoute><AdminVault /></AdminRoute>} />
            <Route path="/admin/knowledge-base" element={<AdminRoute><AdminKnowledgeBase /></AdminRoute>} />
            <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
            <Route path="/admin/report-queue" element={<AdminRoute><AdminReportQueue /></AdminRoute>} />
            <Route path="/admin/videos" element={<AdminRoute><AdminVideos /></AdminRoute>} />
            <Route path="/admin/sessions/:id" element={<AdminRoute><AdminSessionView /></AdminRoute>} />
            <Route path="/admin/broadcast" element={<AdminRoute><AdminBroadcast /></AdminRoute>} />
            <Route path="/admin/sms" element={<AdminRoute><AdminSMS /></AdminRoute>} />
            <Route path="/admin/content-engine" element={<AdminRoute><AdminContentEngine /></AdminRoute>} />
            <Route path="/admin/prospect-lab" element={<AdminRoute><AdminProspectLab /></AdminRoute>} />
            <Route path="/admin/hittrax-import" element={<AdminRoute><AdminHitTraxImport /></AdminRoute>} />
            <Route path="/admin/import-kommodo" element={<AdminRoute><AdminImportKommodo /></AdminRoute>} />
            <Route path="/admin/new-session" element={<AdminRoute><AdminNewSession /></AdminRoute>} />
            <Route path="/admin/session-setup" element={<AdminRoute><AdminSessionSetup /></AdminRoute>} />
            <Route path="/admin/swing-upload" element={<AdminRoute><AdminSwingSessionUpload /></AdminRoute>} />
            <Route path="/admin/analyzer" element={<AdminRoute><AdminRebootAnalysis /></AdminRoute>} />
            <Route path="/admin/admin-analyzer" element={<AdminRoute><AdminAnalyzer /></AdminRoute>} />
            <Route path="/admin/coach-rick-vault" element={<AdminRoute><AdminCoachRickVault /></AdminRoute>} />

            {/* Coach Rick AI sub-routes */}
            <Route path="/admin/coach-rick-ai" element={<AdminRoute><CoachRickAIAdmin /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/test" element={<AdminRoute><CoachRickAITestChat /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/videos" element={<AdminRoute><CoachRickAIVideos /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/cues" element={<AdminRoute><CueBankManager /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/knowledge" element={<AdminRoute><KnowledgeBaseEditor /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/scenarios" element={<AdminRoute><ScenarioTrainer /></AdminRoute>} />
            <Route path="/admin/coach-rick-ai/video-scripts" element={<AdminRoute><VideoScriptAnalyzer /></AdminRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
