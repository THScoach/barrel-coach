import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "./ContentCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, Clock, Archive } from "lucide-react";
import { toast } from "sonner";

export function ContentQueue() {
  const [activeTab, setActiveTab] = useState("ready");
  const queryClient = useQueryClient();

  // Fetch content items with their outputs
  const { data: contentItems, isLoading, refetch } = useQuery({
    queryKey: ['content-items', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('content_items')
        .select(`
          *,
          content_outputs (*)
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'ready') {
        query = query.in('status', ['ready', 'approved']);
      } else if (activeTab === 'pending') {
        query = query.in('status', ['pending', 'processing']);
      } else if (activeTab === 'archived') {
        query = query.eq('status', 'archived');
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Approve content
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_items')
        .update({ status: 'approved' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Content approved!');
    },
  });

  // Archive content
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_items')
        .update({ status: 'archived' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Content archived');
    },
  });

  // Generate more formats
  const generateMoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('process-content', {
        body: { content_item_id: id, regenerate: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success('Generating more formats...');
    },
  });

  const counts = {
    ready: contentItems?.filter(i => ['ready', 'approved'].includes(i.status)).length || 0,
    pending: contentItems?.filter(i => ['pending', 'processing'].includes(i.status)).length || 0,
    archived: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Content Queue</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ready" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Ready
            {counts.ready > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts.ready}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Processing
            {counts.pending > 0 && (
              <Badge variant="secondary" className="ml-1">
                {counts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Archived
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contentItems?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No content in this queue</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {contentItems?.map(item => (
                <ContentCard
                  key={item.id}
                  id={item.id}
                  sourceType={item.source_type as any}
                  rawContent={item.raw_content}
                  transcript={item.transcript}
                  extractedInsights={item.extracted_insights as any[]}
                  topics={item.topics || []}
                  contentType={item.content_type}
                  status={item.status}
                  createdAt={item.created_at}
                  outputs={item.content_outputs}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => archiveMutation.mutate(id)}
                  onGenerateMore={(id) => generateMoreMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
