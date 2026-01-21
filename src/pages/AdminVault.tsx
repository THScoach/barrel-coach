import { useState, useCallback } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, 
  Link, 
  FileText, 
  Trash2, 
  Loader2, 
  BookOpen,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search
} from "lucide-react";
import { format } from "date-fns";

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string | null;
  source_type: 'pdf' | 'doc' | 'url';
  storage_path: string | null;
  original_url: string | null;
  extracted_text: string | null;
  file_size: number | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

export default function AdminVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlDescription, setUrlDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['knowledge-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as KnowledgeDocument[];
    },
  });

  // Process document mutation
  const processDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { data, error } = await supabase.functions.invoke('process-vault-document', {
        body: { documentId: docId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      toast({ title: "Processing started", description: "Document is being processed..." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (doc: KnowledgeDocument) => {
      // Delete from storage if it's a file
      if (doc.storage_path) {
        await supabase.storage.from('coach_knowledge').remove([doc.storage_path]);
      }
      
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', doc.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      toast({ title: "Deleted", description: "Document removed from vault" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const sourceType = fileExt === 'pdf' ? 'pdf' : 'doc';
        const fileName = `${Date.now()}-${file.name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('coach_knowledge')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('knowledge_documents')
          .insert({
            title: file.name,
            source_type: sourceType,
            storage_path: fileName,
            file_size: file.size,
            mime_type: file.type,
            status: 'pending',
          })
          .select()
          .single();
        
        if (docError) throw docError;

        // Trigger processing
        processDocMutation.mutate(docData.id);
      }
      
      toast({ title: "Upload complete", description: "Files are being processed" });
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }, [toast, queryClient, processDocMutation]);

  // Handle URL submission
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    
    setIsUploading(true);
    
    try {
      const { data: docData, error } = await supabase
        .from('knowledge_documents')
        .insert({
          title: urlTitle || urlInput,
          description: urlDescription || null,
          source_type: 'url',
          original_url: urlInput,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;

      // Trigger processing
      processDocMutation.mutate(docData.id);
      
      setUrlInput("");
      setUrlTitle("");
      setUrlDescription("");
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
      
      toast({ title: "URL added", description: "Content is being fetched and processed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'url':
        return <Link className="w-5 h-5 text-blue-400" />;
      default:
        return <FileText className="w-5 h-5 text-purple-400" />;
    }
  };

  const filteredDocs = documents?.filter(doc => 
    !searchQuery || 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            The Vault
          </h1>
          <p className="text-muted-foreground mt-2">
            Private knowledge base for your coaching philosophy. The Research Assistant searches here first.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upload Section */}
          <div className="lg:col-span-1 space-y-4">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Upload PDFs and Word docs with your coaching materials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload PDF or DOC
                        </p>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.doc,.docx"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </CardContent>
            </Card>

            {/* URL Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Add URL
                </CardTitle>
                <CardDescription>
                  Paste links to articles, research papers, or web content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <Input
                  placeholder="Title (optional)"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={urlDescription}
                  onChange={(e) => setUrlDescription(e.target.value)}
                  rows={2}
                />
                <Button 
                  className="w-full" 
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim() || isUploading}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add to Vault
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Documents List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Documents</CardTitle>
                  <CardDescription>
                    {documents?.length || 0} documents in your vault
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredDocs?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No documents yet. Upload files or add URLs to build your vault.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDocs?.map((doc) => (
                      <div 
                        key={doc.id}
                        className="p-4 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getTypeIcon(doc.source_type)}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground truncate">
                                {doc.title}
                              </h3>
                              {doc.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {doc.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                                {doc.file_size && (
                                  <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                                )}
                                {doc.extracted_text && (
                                  <span>{doc.extracted_text.length.toLocaleString()} chars</span>
                                )}
                              </div>
                              {doc.error_message && (
                                <p className="text-xs text-red-400 mt-2">{doc.error_message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {getStatusBadge(doc.status)}
                            {doc.status === 'error' && (
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => processDocMutation.mutate(doc.id)}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => deleteMutation.mutate(doc)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
