import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, BookOpen, Video, Folder, Upload } from "lucide-react";
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
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger 
              value="videos" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger 
              value="collections" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <Folder className="h-4 w-4" />
              Collections
            </TabsTrigger>
            <TabsTrigger 
              value="drills" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <Dumbbell className="h-4 w-4" />
              Drills
            </TabsTrigger>
            <TabsTrigger 
              value="programs" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Programs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            <VideosTab />
          </TabsContent>

          <TabsContent value="collections">
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
