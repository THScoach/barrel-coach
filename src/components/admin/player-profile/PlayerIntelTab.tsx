import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, FileText, StickyNote, Clipboard, Search,
  Eye, Pencil, EyeOff, Loader2, X, Image as ImageIcon,
  FileIcon, RefreshCw,
} from "lucide-react";

interface Props {
  playersTableId?: string;
  playerName?: string;
}

const DOC_TYPES = [
  { value: "note", label: "Coach Note" },
  { value: "omar_report", label: "OMAR Report" },
  { value: "kinetic_sequence", label: "Kinetic Sequence" },
  { value: "reboot_report", label: "Reboot Report" },
  { value: "scouting_report", label: "Scouting Report" },
  { value: "medical", label: "Medical/Injury" },
  { value: "video_breakdown", label: "Video Breakdown" },
  { value: "image", label: "Image" },
  { value: "pdf", label: "PDF" },
  { value: "other", label: "Other" },
];

const TYPE_COLORS: Record<string, string> = {
  omar_report: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  kinetic_sequence: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  reboot_report: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scouting_report: "bg-green-500/20 text-green-400 border-green-500/30",
  medical: "bg-red-500/20 text-red-400 border-red-500/30",
  note: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  video_breakdown: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  image: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  pdf: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  other: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const TYPE_ICONS: Record<string, string> = {
  omar_report: "📊",
  kinetic_sequence: "🔬",
  reboot_report: "🔄",
  scouting_report: "🔍",
  medical: "🏥",
  note: "📝",
  video_breakdown: "🎬",
  image: "🖼️",
  pdf: "📄",
  other: "📎",
};

export function PlayerIntelTab({ playersTableId, playerName }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("other");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  // Note form state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["player-intel", playersTableId, searchQuery, typeFilter],
    queryFn: async () => {
      if (!playersTableId) return [];
      let query = supabase
        .from("player_documents")
        .select("*")
        .eq("player_id", playersTableId)
        .order("created_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("document_type", typeFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(
          `title.ilike.%${searchQuery}%,content_text.ilike.%${searchQuery}%,ai_extracted_text.ilike.%${searchQuery}%,tags.cs.{${searchQuery.toLowerCase()}}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!playersTableId,
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large. Max 25MB.");
      return;
    }
    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    // Auto-detect type
    if (file.type.startsWith("image/")) setUploadType("image");
    else if (file.type === "application/pdf") setUploadType("pdf");
    else setUploadType("other");
    setShowUploadModal(true);
  };

  // Handle paste
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setUploadFile(file);
          setUploadTitle(`Screenshot ${new Date().toLocaleDateString()}`);
          setUploadType("omar_report");
          setShowPasteModal(false);
          setShowUploadModal(true);
        }
        return;
      }
    }
    toast.error("No image found in clipboard. Try Cmd+V after taking a screenshot.");
  }, []);

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!playersTableId || !uploadFile) throw new Error("Missing data");
      setUploading(true);

      // Upload file to storage
      const timestamp = Date.now();
      const filePath = `${playersTableId}/${timestamp}_${uploadFile.name}`;
      const { error: storageError } = await supabase.storage
        .from("player-intel")
        .upload(filePath, uploadFile);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("player-intel")
        .getPublicUrl(filePath);

      // Create document record
      const tags = uploadTags.split(",").map(t => t.trim()).filter(Boolean);
      const { data: doc, error: insertError } = await supabase
        .from("player_documents")
        .insert({
          player_id: playersTableId,
          title: uploadTitle,
          description: uploadDescription || null,
          document_type: uploadType,
          file_url: urlData.publicUrl,
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size_bytes: uploadFile.size,
          tags,
          source: "manual_upload",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // If image, trigger AI extraction
      if (uploadFile.type.startsWith("image/") && doc) {
        triggerAIExtraction(doc.id, uploadFile);
      }

      return doc;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["player-intel"] });
      resetUploadForm();
    },
    onError: (err: any) => {
      toast.error(`Upload failed: ${err.message}`);
    },
    onSettled: () => setUploading(false),
  });

  // AI extraction for images
  const triggerAIExtraction = async (docId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const { error } = await supabase.functions.invoke("process-player-intel", {
          body: { documentId: docId, imageBase64: base64, imageMimeType: file.type },
        });
        if (error) console.error("AI extraction error:", error);
        else {
          queryClient.invalidateQueries({ queryKey: ["player-intel"] });
          toast.success("AI extraction complete");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("AI extraction trigger failed:", err);
    }
  };

  // Save note mutation
  const saveNoteMutation = useMutation({
    mutationFn: async () => {
      if (!playersTableId) throw new Error("No player");
      const tags = noteTags.split(",").map(t => t.trim()).filter(Boolean);
      const { error } = await supabase.from("player_documents").insert({
        player_id: playersTableId,
        title: noteTitle,
        content_text: noteContent,
        document_type: "note",
        tags,
        source: "coach_note",
      });
      if (error) throw error;

      // Generate AI summary for the note
      const { data: doc } = await supabase
        .from("player_documents")
        .select("id")
        .eq("player_id", playersTableId)
        .eq("title", noteTitle)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (doc) {
        supabase.functions.invoke("process-player-intel", {
          body: { documentId: doc.id, noteText: noteContent },
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      toast.success("Note saved");
      queryClient.invalidateQueries({ queryKey: ["player-intel"] });
      setShowNoteModal(false);
      setNoteTitle("");
      setNoteContent("");
      setNoteTags("");
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  // Update document mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoc) return;
      const tags = editTags.split(",").map(t => t.trim()).filter(Boolean);
      const { error } = await supabase
        .from("player_documents")
        .update({
          title: editTitle,
          document_type: editType,
          tags,
          description: editDescription || null,
        })
        .eq("id", selectedDoc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document updated");
      queryClient.invalidateQueries({ queryKey: ["player-intel"] });
      setShowEditModal(false);
    },
    onError: (err: any) => toast.error(`Update failed: ${err.message}`),
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("player_documents")
        .update({ is_active: false })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deactivated");
      queryClient.invalidateQueries({ queryKey: ["player-intel"] });
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("player_documents")
        .update({ is_active: true })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document reactivated");
      queryClient.invalidateQueries({ queryKey: ["player-intel"] });
    },
  });

  const resetUploadForm = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadTitle("");
    setUploadType("other");
    setUploadTags("");
    setUploadDescription("");
  };

  const openEdit = (doc: any) => {
    setSelectedDoc(doc);
    setEditTitle(doc.title);
    setEditType(doc.document_type);
    setEditTags((doc.tags || []).join(", "));
    setEditDescription(doc.description || "");
    setShowEditModal(true);
  };

  const openView = (doc: any) => {
    setSelectedDoc(doc);
    setShowViewModal(true);
  };

  const getSignedUrl = async (fileUrl: string) => {
    // Extract the path from the full URL
    const pathMatch = fileUrl.match(/player-intel\/(.+)$/);
    if (!pathMatch) return fileUrl;
    const { data } = await supabase.storage
      .from("player-intel")
      .createSignedUrl(pathMatch[1], 3600);
    return data?.signedUrl || fileUrl;
  };

  if (!playersTableId) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-8 text-center text-slate-500">
          Save the player first to add intel documents.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="bg-slate-900 border-slate-800 border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📎</span>
            <h3 className="text-white font-semibold text-lg">Add Player Intel</h3>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNoteTitle("");
                setNoteContent("");
                setNoteTags("");
                setShowNoteModal(true);
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <StickyNote className="w-4 h-4 mr-2" />
              Add Note
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPasteModal(true)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Clipboard className="w-4 h-4 mr-2" />
              Paste Screenshot
            </Button>
          </div>

          <p className="text-sm text-slate-500">
            Drag & drop images, PDFs, or screenshots here · Supports: JPG, PNG, PDF, DOCX up to 25MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search intel..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48 bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading intel...
        </div>
      ) : documents.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8 text-center text-slate-500">
            No intel documents yet. Upload files, add notes, or paste screenshots to build this player's knowledge base.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any) => (
            <Card
              key={doc.id}
              className={`bg-slate-900 border-slate-800 ${!doc.is_active ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{TYPE_ICONS[doc.document_type] || "📎"}</span>
                      <h4 className="text-white font-medium truncate">{doc.title}</h4>
                      <span className="text-xs text-slate-500">
                        {new Date(doc.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={TYPE_COLORS[doc.document_type] || TYPE_COLORS.other}
                      >
                        {DOC_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}
                      </Badge>
                      {(doc.tags || []).map((tag: string) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="bg-slate-800/50 text-slate-400 border-slate-700 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {!doc.is_active && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-slate-400 line-clamp-2">
                      {doc.ai_summary || doc.content_text?.substring(0, 200) || doc.description || "No preview available"}
                    </p>

                    {doc.ai_extracted_text && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        AI Extracted: {doc.ai_extracted_text.substring(0, 120)}...
                      </p>
                    )}
                  </div>

                  {/* Thumbnail for images */}
                  {doc.file_type?.startsWith("image/") && doc.file_url && (
                    <div className="w-[120px] h-[80px] rounded-md overflow-hidden bg-slate-800 flex-shrink-0">
                      <img
                        src={doc.file_url}
                        alt={doc.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Try signed URL for private bucket
                          getSignedUrl(doc.file_url).then(url => {
                            (e.target as HTMLImageElement).src = url;
                          });
                        }}
                      />
                    </div>
                  )}

                  {doc.file_type === "application/pdf" && (
                    <div className="w-[120px] h-[80px] rounded-md bg-slate-800 flex-shrink-0 flex items-center justify-center">
                      <FileIcon className="w-8 h-8 text-rose-400" />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openView(doc)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(doc)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {doc.is_active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivateMutation.mutate(doc.id)}
                      className="text-slate-400 hover:text-red-400 hover:bg-slate-800"
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-1" /> Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => reactivateMutation.mutate(doc.id)}
                      className="text-slate-400 hover:text-green-400 hover:bg-slate-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Paste Screenshot Modal */}
      <Dialog open={showPasteModal} onOpenChange={setShowPasteModal}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Paste Screenshot</DialogTitle>
          </DialogHeader>
          <div
            ref={pasteRef}
            onPaste={handlePaste}
            tabIndex={0}
            className="border-2 border-dashed border-slate-700 rounded-lg p-12 text-center focus:border-blue-500 focus:outline-none cursor-pointer"
            onClick={() => pasteRef.current?.focus()}
          >
            <Clipboard className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 mb-1">Click here and press Cmd+V / Ctrl+V</p>
            <p className="text-xs text-slate-500">Screenshot from OMAR, kinetic sequence reports, etc.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Details Modal */}
      <Dialog open={showUploadModal} onOpenChange={v => { if (!v) resetUploadForm(); }}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Upload Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadFile && (
              <div className="bg-slate-800 rounded-md p-3 flex items-center gap-3">
                {uploadFile.type.startsWith("image/") ? (
                  <ImageIcon className="w-5 h-5 text-indigo-400" />
                ) : (
                  <FileIcon className="w-5 h-5 text-rose-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{uploadFile.name}</p>
                  <p className="text-xs text-slate-500">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-slate-300">Title</Label>
              <Input
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Document Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Tags (comma-separated)</Label>
              <Input
                value={uploadTags}
                onChange={e => setUploadTags(e.target.value)}
                placeholder="pelvis, timing, sequence"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-slate-300">Description (optional)</Label>
              <Textarea
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetUploadForm} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploading || !uploadTitle}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Coach Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Title</Label>
              <Input
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                placeholder="e.g., Pelvis inhibition pattern"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Note Content</Label>
              <Textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Write your coaching observations..."
                className="bg-slate-800 border-slate-700 text-white"
                rows={6}
              />
            </div>
            <div>
              <Label className="text-slate-300">Tags (comma-separated)</Label>
              <Input
                value={noteTags}
                onChange={e => setNoteTags(e.target.value)}
                placeholder="pelvis_inhibition, load_swing"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNoteModal(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => saveNoteMutation.mutate()}
              disabled={!noteTitle || !noteContent || saveNoteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saveNoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <span>{TYPE_ICONS[selectedDoc?.document_type] || "📎"}</span>
              {selectedDoc?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={TYPE_COLORS[selectedDoc.document_type] || TYPE_COLORS.other}
                >
                  {DOC_TYPES.find(t => t.value === selectedDoc.document_type)?.label}
                </Badge>
                <span className="text-xs text-slate-500">
                  {new Date(selectedDoc.created_at).toLocaleString()}
                </span>
              </div>

              {selectedDoc.description && (
                <p className="text-sm text-slate-400">{selectedDoc.description}</p>
              )}

              {/* Image display */}
              {selectedDoc.file_type?.startsWith("image/") && selectedDoc.file_url && (
                <ViewImage fileUrl={selectedDoc.file_url} alt={selectedDoc.title} />
              )}

              {/* PDF link */}
              {selectedDoc.file_type === "application/pdf" && selectedDoc.file_url && (
                <div className="bg-slate-800 rounded-md p-4">
                  <a
                    href={selectedDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-2"
                  >
                    <FileIcon className="w-5 h-5" />
                    Open PDF: {selectedDoc.file_name}
                  </a>
                </div>
              )}

              {/* Note content */}
              {selectedDoc.content_text && (
                <div className="bg-slate-800 rounded-md p-4">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase">Content</h4>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedDoc.content_text}</p>
                </div>
              )}

              {/* AI Summary */}
              {selectedDoc.ai_summary && (
                <div className="bg-blue-950/30 border border-blue-800/30 rounded-md p-4">
                  <h4 className="text-xs font-semibold text-blue-400 mb-2 uppercase">AI Summary</h4>
                  <p className="text-sm text-slate-300">{selectedDoc.ai_summary}</p>
                </div>
              )}

              {/* AI Extracted Text */}
              {selectedDoc.ai_extracted_text && (
                <div className="bg-teal-950/30 border border-teal-800/30 rounded-md p-4">
                  <h4 className="text-xs font-semibold text-teal-400 mb-2 uppercase">AI Extracted Text</h4>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap font-mono text-xs">
                    {selectedDoc.ai_extracted_text}
                  </p>
                </div>
              )}

              {/* Tags */}
              {selectedDoc.tags?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Tags:</span>
                  {selectedDoc.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="bg-slate-800/50 text-slate-400 border-slate-700 text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Document Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Title</Label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Document Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {DOC_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Tags (comma-separated)</Label>
              <Input
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <Textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditModal(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editTitle || updateMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for viewing images from private bucket
function ViewImage({ fileUrl, alt }: { fileUrl: string; alt: string }) {
  const [src, setSrc] = useState(fileUrl);

  const handleError = async () => {
    const pathMatch = fileUrl.match(/player-intel\/(.+)$/);
    if (!pathMatch) return;
    const { data } = await supabase.storage
      .from("player-intel")
      .createSignedUrl(pathMatch[1], 3600);
    if (data?.signedUrl) setSrc(data.signedUrl);
  };

  return (
    <div className="rounded-md overflow-hidden bg-slate-800">
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[500px] object-contain mx-auto"
        onError={handleError}
      />
    </div>
  );
}
