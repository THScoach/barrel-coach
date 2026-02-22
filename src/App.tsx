import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Core pages
import Landing from "./pages/Landing";
import Athletes from "./pages/Athletes";
import AthleteDetail from "./pages/AthleteDetail";
import Upload from "./pages/Upload";
import SwingUpload from "./pages/SwingUpload";
import SessionView from "./pages/SessionView";
import SwingReport from "./pages/SwingReport";

// Auth & legal
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Pricing from "./pages/Pricing";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";

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

            {/* Core app routes */}
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes" element={<Athletes />} />
            <Route path="/athletes/:id" element={<AthleteDetail />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/analyze" element={<SwingUpload />} />
            <Route path="/session/:sessionId" element={<SessionView />} />
            <Route path="/sessions/:sessionId" element={<SessionView />} />
            <Route path="/report/:sessionId" element={<SwingReport />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />

            {/* Legal & info */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/welcome" element={<Welcome />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
