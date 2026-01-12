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

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminMessages from "./pages/AdminMessages";
import AdminVideos from "./pages/AdminVideos";
import AdminAnalyzer from "./pages/AdminAnalyzer";
import AdminNewSession from "./pages/AdminNewSession";
import AdminPlayers from "./pages/AdminPlayers";
import AdminPlayerProfile from "./pages/AdminPlayerProfile";
import AdminImportKommodo from "./pages/AdminImportKommodo";
import AdminSMS from "./pages/AdminSMS";
import AdminRebootAnalysis from "./pages/AdminRebootAnalysis";
import AdminHitTraxImport from "./pages/AdminHitTraxImport";
import AdminLibrary from "./pages/AdminLibrary";

// Player pages
import PlayerHome from "./pages/player/PlayerHome";
import PlayerData from "./pages/player/PlayerData";
import PlayerDrills from "./pages/player/PlayerDrills";
import PlayerMessages from "./pages/player/PlayerMessages";
import PlayerProfile from "./pages/player/PlayerProfile";
import PlayerNewSession from "./pages/player/PlayerNewSession";
import PlayerWeeklyCheckin from "./pages/player/PlayerWeeklyCheckin";
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
              <Route path="/coaching" element={<Coaching />} />

              {/* Player Portal Routes */}
              <Route path="/player" element={<PlayerLayout />}>
                <Route index element={<PlayerHome />} />
                <Route path="data" element={<PlayerData />} />
                <Route path="drills" element={<PlayerDrills />} />
                <Route path="messages" element={<PlayerMessages />} />
                <Route path="profile" element={<PlayerProfile />} />
                <Route path="new-session" element={<PlayerNewSession />} />
                <Route path="weekly-checkin" element={<PlayerWeeklyCheckin />} />
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
