import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import { ProtectedAdminRoute } from "@/components/ProtectedAdminRoute";
import Index from "./pages/Index";
import Analyze from "./pages/Analyze";
import About from "./pages/About";
import InnerCircle from "./pages/InnerCircle";
import Assessment from "./pages/Assessment";
import AdminMessages from "./pages/AdminMessages";
import AdminVideos from "./pages/AdminVideos";
import AdminImportKommodo from "./pages/AdminImportKommodo";
import AdminSMS from "./pages/AdminSMS";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AnalysisProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/about" element={<About />} />
            <Route path="/inner-circle" element={<InnerCircle />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/library" element={<Library />} />
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
            <Route path="/admin/import-kommodo" element={
              <ProtectedAdminRoute>
                <AdminImportKommodo />
              </ProtectedAdminRoute>
            } />
            <Route path="/admin/sms" element={
              <ProtectedAdminRoute>
                <AdminSMS />
              </ProtectedAdminRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AnalysisProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
