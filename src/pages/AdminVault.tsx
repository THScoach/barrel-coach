import { useState, useCallback } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Search,
  AlertTriangle,
  Copy,
  Sparkles,
  Eraser
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
  file_hash: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

interface DuplicateGroup {
  file_hash: string;
  duplicate_count: number;
  document_ids: string[];
  document_titles: string[];
  total_size: number;
}

// Hash function for browser (using Web Crypto API)
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

export default function AdminVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlDescription, setUrlDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, { status: string; name: string }>>({});
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  // Fetch duplicates for cleanup
  const { data: duplicates, refetch: refetchDuplicates } = useQuery({
    queryKey: ['duplicate-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('find_duplicate_documents');
      if (error) throw error;
      return (data || []) as DuplicateGroup[];
    },
    enabled: isCleanupOpen,
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
      refetchDuplicates();
      toast({ title: "Deleted", description: "Document removed from vault" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Check for duplicate by hash
  const checkDuplicateHash = async (hash: string): Promise<{ exists: boolean; title?: string }> => {
    const { data } = await supabase.rpc('check_duplicate_document', { p_file_hash: hash });
    if (data && data.length > 0) {
      return { exists: true, title: data[0].title };
    }
    return { exists: false };
  };

  // Check for duplicate URL
  const checkDuplicateUrl = async (url: string): Promise<{ exists: boolean; title?: string }> => {
    const { data } = await supabase.rpc('check_duplicate_url', { p_url: url });
    if (data && data.length > 0) {
      return { exists: true, title: data[0].title };
    }
    return { exists: false };
  };

  // Handle file upload with deduplication
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const progressMap: Record<string, { status: string; name: string }> = {};
    
    try {
      for (const file of Array.from(files)) {
        const fileId = `${Date.now()}-${file.name}`;
        progressMap[fileId] = { status: 'hashing', name: file.name };
        setUploadProgress({ ...progressMap });

        const fileHash = await hashFile(file);
        
        progressMap[fileId].status = 'checking';
        setUploadProgress({ ...progressMap });
        
        const duplicate = await checkDuplicateHash(fileHash);
        if (duplicate.exists) {
          progressMap[fileId].status = 'duplicate';
          setUploadProgress({ ...progressMap });
          toast({ 
            title: "Duplicate Detected", 
            description: `"${file.name}" already exists as "${duplicate.title}"`,
            variant: "destructive"
          });
          continue;
        }

        progressMap[fileId].status = 'uploading';
        setUploadProgress({ ...progressMap });
        
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const sourceType = fileExt === 'pdf' ? 'pdf' : 'doc';
        const fileName = `${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('coach_knowledge')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;

        progressMap[fileId].status = 'saving';
        setUploadProgress({ ...progressMap });
        
        const { data: docData, error: docError } = await supabase
          .from('knowledge_documents')
          .insert({
            title: file.name,
            source_type: sourceType,
            storage_path: fileName,
            file_size: file.size,
            file_hash: fileHash,
            mime_type: file.type,
            status: 'pending',
          })
          .select()
          .single();
        
        if (docError) throw docError;

        progressMap[fileId].status = 'processing';
        setUploadProgress({ ...progressMap });
        processDocMutation.mutate(docData.id);
        
        progressMap[fileId].status = 'done';
        setUploadProgress({ ...progressMap });
      }
      
      toast({ title: "Upload complete", description: "Files are being processed" });
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress({});
      event.target.value = '';
    }
  }, [toast, queryClient, processDocMutation]);

  // Handle URL submission with deduplication
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    
    setIsUploading(true);
    
    try {
      const duplicate = await checkDuplicateUrl(urlInput.trim());
      if (duplicate.exists) {
        toast({ 
          title: "Duplicate URL", 
          description: `This URL already exists as "${duplicate.title}"`,
          variant: "destructive"
        });
        setIsUploading(false);
        return;
      }

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

  // Scan existing documents for duplicates
  const scanForDuplicates = async () => {
    setIsScanning(true);
    toast({ title: "Scanning", description: "Checking for duplicates in existing documents..." });
    
    try {
      const { data: unhashed } = await supabase
        .from('knowledge_documents')
        .select('id, storage_path, original_url')
        .is('file_hash', null);

      for (const doc of (unhashed || [])) {
        if (doc.original_url) {
          const encoder = new TextEncoder();
          const data = encoder.encode(doc.original_url);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const urlHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
          
          await supabase
            .from('knowledge_documents')
            .update({ file_hash: `url:${urlHash}` })
            .eq('id', doc.id);
        }
      }

      await refetchDuplicates();
      toast({ title: "Scan complete", description: "Duplicate analysis updated" });
    } catch (error: any) {
      toast({ title: "Scan failed", description: error.message, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteDuplicate = async (docId: string) => {
    const doc = documents?.find(d => d.id === docId);
    if (doc) {
      deleteMutation.mutate(doc);
    }
  };

  // Toggle selection of a duplicate document
  const toggleDuplicateSelection = (docId: string) => {
    setSelectedDuplicates(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Select all duplicates (excluding the first "keep" item in each group)
  const selectAllDuplicates = () => {
    if (!duplicates) return;
    const allDuplicateIds = new Set<string>();
    duplicates.forEach(group => {
      group.document_ids.slice(1).forEach(id => allDuplicateIds.add(id));
    });
    setSelectedDuplicates(allDuplicateIds);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedDuplicates(new Set());
  };

  // Bulk delete selected duplicates
  const handleBulkDelete = async () => {
    if (selectedDuplicates.size === 0) return;
    
    setIsBulkDeleting(true);
    const idsToDelete = Array.from(selectedDuplicates);
    let successCount = 0;
    let errorCount = 0;

    for (const docId of idsToDelete) {
      const doc = documents?.find(d => d.id === docId);
      if (doc) {
        try {
          if (doc.storage_path) {
            await supabase.storage.from('coach_knowledge').remove([doc.storage_path]);
          }
          const { error } = await supabase
            .from('knowledge_documents')
            .delete()
            .eq('id', doc.id);
          if (error) throw error;
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Failed to delete:', doc.id, err);
        }
      }
    }

    setSelectedDuplicates(new Set());
    queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] });
    refetchDuplicates();
    setIsBulkDeleting(false);

    toast({
      title: "Bulk Delete Complete",
      description: `Deleted ${successCount} document(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
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

  const getUploadStatusIcon = (status: string) => {
    switch (status) {
      case 'hashing':
        return <Sparkles className="w-4 h-4 animate-pulse text-purple-400" />;
      case 'checking':
        return <Search className="w-4 h-4 animate-pulse text-blue-400" />;
      case 'duplicate':
        return <Copy className="w-4 h-4 text-red-400" />;
      case 'uploading':
        return <Upload className="w-4 h-4 animate-bounce text-yellow-400" />;
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'processing':
        return <Sparkles className="w-4 h-4 animate-pulse text-primary" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              The Vault
            </h1>
            <p className="text-muted-foreground mt-2">
              Private knowledge base with duplicate prevention. Files are hashed before upload.
            </p>
          </div>
          
          <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Eraser className="w-4 h-4" />
                Cleanup Utility
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eraser className="w-5 h-5" />
                  Duplicate Cleanup
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    Scan your vault for duplicate files and URLs
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={scanForDuplicates}
                      disabled={isScanning || isBulkDeleting}
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Scan Now
                    </Button>
                  </div>
                </div>

                {duplicates && duplicates.length > 0 && (
                  <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {selectedDuplicates.size} selected
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={selectAllDuplicates}
                        disabled={isBulkDeleting}
                        className="text-xs h-7"
                      >
                        Select All Duplicates
                      </Button>
                      {selectedDuplicates.size > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearSelection}
                          disabled={isBulkDeleting}
                          className="text-xs h-7"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={selectedDuplicates.size === 0 || isBulkDeleting}
                      className="gap-1"
                    >
                      {isBulkDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete Selected ({selectedDuplicates.size})
                    </Button>
                  </div>
                )}

                <ScrollArea className="h-[400px] border rounded-lg">
                  {!duplicates || duplicates.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-400" />
                      <p className="font-medium">No Duplicates Found</p>
                      <p className="text-sm mt-1">Your vault is clean!</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <span className="font-medium">{duplicates.length} duplicate group(s) found</span>
                      </div>
                      
                      {duplicates.map((group) => (
                        <Card key={group.file_hash} className="border-yellow-500/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">
                                {group.duplicate_count} duplicate files
                              </CardTitle>
                              <Badge variant="secondary">
                                {(group.total_size / 1024).toFixed(0)} KB total
                              </Badge>
                            </div>
                            <CardDescription className="text-xs font-mono">
                              Hash: {group.file_hash?.substring(0, 16)}...
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {group.document_titles.map((title, idx) => {
                              const docId = group.document_ids[idx];
                              const isSelected = selectedDuplicates.has(docId);
                              return (
                                <div 
                                  key={docId} 
                                  className={`flex items-center justify-between p-2 rounded ${
                                    idx === 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                                  } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {idx !== 0 && (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleDuplicateSelection(docId)}
                                        disabled={isBulkDeleting}
                                        className="w-4 h-4 rounded border-muted-foreground/50 text-primary focus:ring-primary"
                                      />
                                    )}
                                    {idx === 0 ? (
                                      <Badge className="bg-green-500/20 text-green-400 text-xs">Keep</Badge>
                                    ) : (
                                      <Badge className="bg-red-500/20 text-red-400 text-xs">Duplicate</Badge>
                                    )}
                                    <span className="text-sm truncate max-w-[180px]">{title}</span>
                                  </div>
                                  {idx !== 0 && (
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      className="text-red-400 hover:text-red-300 h-7"
                                      onClick={() => handleDeleteDuplicate(docId)}
                                      disabled={isBulkDeleting}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Remove
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(uploadProgress).length > 0 && (
          <Card className="mb-6 border-primary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(uploadProgress).map(([id, { status, name }]) => (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    {getUploadStatusIcon(status)}
                    <span className="truncate flex-1">{name}</span>
                    <span className="text-muted-foreground capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Files are hashed to prevent duplicates automatically
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
                        <p className="text-sm text-muted-foreground">Click to upload PDF or DOC</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Duplicates will be blocked</p>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Add URL
                </CardTitle>
                <CardDescription>
                  URLs are checked for duplicates before processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="https://..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
                <Input placeholder="Title (optional)" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} />
                <Textarea placeholder="Description (optional)" value={urlDescription} onChange={(e) => setUrlDescription(e.target.value)} rows={2} />
                <Button className="w-full" onClick={handleUrlSubmit} disabled={!urlInput.trim() || isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add to Vault
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Knowledge Documents</CardTitle>
                  <CardDescription>{documents?.length || 0} documents in your vault</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
                      <div key={doc.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getTypeIcon(doc.source_type)}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground truncate">{doc.title}</h3>
                              {doc.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.description}</p>}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                                {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                                {doc.file_hash && <span className="font-mono text-primary/70" title={doc.file_hash}>#{doc.file_hash.substring(0, 8)}</span>}
                                {doc.extracted_text && <span>{doc.extracted_text.length.toLocaleString()} chars</span>}
                              </div>
                              {doc.error_message && <p className="text-xs text-red-400 mt-2">{doc.error_message}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {getStatusBadge(doc.status)}
                            {doc.status === 'error' && (
                              <Button size="icon" variant="ghost" onClick={() => processDocMutation.mutate(doc.id)}>
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteMutation.mutate(doc)}>
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