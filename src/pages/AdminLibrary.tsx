import { useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, BookOpen } from "lucide-react";
import { DrillsTab } from "@/components/library/DrillsTab";
import { ProgramsTab } from "@/components/library/ProgramsTab";

export default function AdminLibrary() {
  const [activeTab, setActiveTab] = useState("drills");

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <p className="text-slate-400 mt-1">
            Manage drill templates and training programs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
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
