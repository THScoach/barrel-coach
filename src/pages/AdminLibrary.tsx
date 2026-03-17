import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, BookOpen, Video, ListVideo, Upload } from "lucide-react";
import { DrillsTab } from "@/components/library/DrillsTab";
import { ProgramsTab } from "@/components/library/ProgramsTab";
import { VideosTab } from "@/components/library/VideosTab";
import { CollectionsTab } from "@/components/library/CollectionsTab";
import { TranscriptSearch } from "@/components/library/TranscriptSearch";
import { AcademyUploader } from "@/components/library/AcademyUploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AdminLibrary() {
  const [activeTab, setActiveTab] = useState("videos");
  const { toast } = useToast();

  const handleUploadComplete = (videoId: string) => {
    toast({
      title: "Video Added",
      description: "Your video is being transcribed and will appear in the library shortly."
    });
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Internal Academy</h1>
          <p className="text-slate-400 mt-1">
            Your private video library with transcript search & auto-prescriptions
          </p>
        </div>

        {/* Top Row: Upload + Search */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Academy Uploader */}
          <AcademyUploader 
            onUploadComplete={handleUploadComplete}
            autoPublish={false}
          />

          {/* Transcript Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Search by Transcript
              </CardTitle>
              <CardDescription>
                Find videos where you mentioned specific words or phrases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptSearch showInlinePlayer />
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex gap-6 border-b border-border">
            {[
              { value: "videos", icon: Video, label: "Videos" },
              { value: "playlists", icon: ListVideo, label: "Playlists" },
              { value: "drills", icon: Dumbbell, label: "Drills" },
              { value: "programs", icon: BookOpen, label: "Programs" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === tab.value
                    ? "text-white border-primary"
                    : "text-[#6B7A8F] border-transparent hover:text-white"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <TabsContent value="videos">
            <VideosTab />
          </TabsContent>

          <TabsContent value="playlists">
            <CollectionsTab />
          </TabsContent>

          <TabsContent value="drills">
            <DrillsTab />
          </TabsContent>

          <TabsContent value="programs">
            <ProgramsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
