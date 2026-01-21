import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, BookOpen, Video, Folder, Search } from "lucide-react";
import { DrillsTab } from "@/components/library/DrillsTab";
import { ProgramsTab } from "@/components/library/ProgramsTab";
import { VideosTab } from "@/components/library/VideosTab";
import { CollectionsTab } from "@/components/library/CollectionsTab";
import { ConceptSearch } from "@/components/library/ConceptSearch";

export default function AdminLibrary() {
  const [activeTab, setActiveTab] = useState("videos");

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <p className="text-slate-400 mt-1">
            Videos, drills, collections, and training programs
          </p>
        </div>

        {/* Concept Search */}
        <div className="mb-8">
          <ConceptSearch />
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
