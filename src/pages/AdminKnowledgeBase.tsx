import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  BookOpen, 
  FileText, 
  Brain, 
  Zap, 
  Target, 
  Activity,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import DOMPurify from "dompurify";

interface KnowledgeDocument {
  id: string;
  title: string;
  description: string;
  filename: string;
  sections: Section[];
  icon: React.ReactNode;
  color: string;
}

interface Section {
  title: string;
  level: number;
  content: string;
  anchor: string;
}

const KNOWLEDGE_DOCS: Omit<KnowledgeDocument, 'sections'>[] = [
  {
    id: "knowledge-base",
    title: "Catching Barrels Knowledge Base",
    description: "Technical formulas, 4B scoring logic, motor profiles, and KRS methodology",
    filename: "catching_barrels_knowledge_base.md",
    icon: <Target className="w-5 h-5" />,
    color: "bg-gradient-to-r from-red-600 to-orange-500"
  },
  {
    id: "claude-export",
    title: "Coach Rick Philosophy",
    description: "Core philosophy, motor profile nuances, and the 'We don't add, we unlock' methodology",
    filename: "claude_knowledge_export.md",
    icon: <Brain className="w-5 h-5" />,
    color: "bg-gradient-to-r from-blue-600 to-cyan-500"
  },
  {
    id: "content-engine",
    title: "Content Engine Spec",
    description: "Content automation build requirements and specifications",
    filename: "content_engine_spec.md",
    icon: <Zap className="w-5 h-5" />,
    color: "bg-gradient-to-r from-purple-600 to-pink-500"
  }
];

function parseMarkdownSections(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let contentBuffer: string[] = [];

  const flushSection = () => {
    if (currentSection) {
      currentSection.content = contentBuffer.join('\n').trim();
      sections.push(currentSection);
    }
    contentBuffer = [];
  };

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h1Match || h2Match || h3Match) {
      flushSection();
      const match = h1Match || h2Match || h3Match;
      const level = h1Match ? 1 : h2Match ? 2 : 3;
      const title = match![1];
      currentSection = {
        title,
        level,
        content: '',
        anchor: title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      };
    } else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  flushSection();
  return sections;
}

function formatMarkdown(text: string): string {
  let html = text
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-slate-900 p-3 rounded-lg overflow-x-auto my-3 text-sm"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-red-400 text-sm">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => c.trim().match(/^[-:]+$/))) {
        return ''; // Skip separator rows
      }
      const cellHtml = cells.map(c => `<td class="border border-slate-700 px-3 py-2">${c.trim()}</td>`).join('');
      return `<tr>${cellHtml}</tr>`;
    })
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-slate-300">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-red-500 pl-4 my-2 text-slate-400 italic">$1</blockquote>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="my-3 text-slate-300">')
    .replace(/\n/g, '<br/>');

  // Wrap tables
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, '<table class="w-full border-collapse my-4 text-sm">$&</table>');

  return `<p class="my-3 text-slate-300">${html}</p>`;
}

export default function AdminKnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      const loadedDocs: KnowledgeDocument[] = [];

      for (const doc of KNOWLEDGE_DOCS) {
        try {
          const response = await fetch(`/knowledge/${doc.filename}`);
          const text = await response.text();
          const sections = parseMarkdownSections(text);
          loadedDocs.push({ ...doc, sections });
        } catch (error) {
          console.error(`Failed to load ${doc.filename}:`, error);
        }
      }

      setDocuments(loadedDocs);
      if (loadedDocs.length > 0) {
        setSelectedDoc(loadedDocs[0]);
      }
      setLoading(false);
    };

    loadDocuments();
  }, []);

  const filteredSections = selectedDoc?.sections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const globalSearchResults = searchQuery.length > 2 
    ? documents.flatMap(doc => 
        doc.sections
          .filter(s => 
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map(s => ({ ...s, docTitle: doc.title, docId: doc.id }))
      )
    : [];

  const highlightText = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200 rounded px-0.5">$1</mark>');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      
      <main className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-500">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
              <p className="text-slate-400">Browse and search Catching Barrels documentation</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-slate-400 border-slate-700">
              {documents.reduce((acc, d) => acc + d.sections.length, 0)} sections
            </Badge>
            <Badge variant="outline" className="text-slate-400 border-slate-700">
              {documents.length} documents
            </Badge>
          </div>
        </div>

        {/* Global Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            placeholder="Search all documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 text-lg"
          />
          {searchQuery.length > 2 && globalSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                <p className="text-xs text-slate-500 px-3 py-2">
                  {globalSearchResults.length} results across all documents
                </p>
                {globalSearchResults.slice(0, 10).map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const doc = documents.find(d => d.id === result.docId);
                      if (doc) {
                        setSelectedDoc(doc);
                        setSelectedSection(result);
                        setSearchQuery("");
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                      <span 
                        className="text-white font-medium"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(highlightText(result.title, searchQuery)) 
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 ml-6">{result.docTitle}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Document Selection */}
          <div className="lg:col-span-1 space-y-4">
            {/* Document Cards */}
            {documents.map((doc) => (
              <Card 
                key={doc.id}
                className={`cursor-pointer transition-all ${
                  selectedDoc?.id === doc.id 
                    ? 'bg-slate-800 border-red-500/50 ring-2 ring-red-500/20' 
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => {
                  setSelectedDoc(doc);
                  setSelectedSection(null);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${doc.color} text-white`}>
                      {doc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">{doc.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.description}</p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {doc.sections.length} sections
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Table of Contents */}
            {selectedDoc && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Table of Contents
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 pt-0 space-y-1">
                      {filteredSections.map((section, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSection(section)}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedSection?.anchor === section.anchor
                              ? 'bg-red-500/20 text-red-400'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          style={{ paddingLeft: `${(section.level - 1) * 12 + 12}px` }}
                        >
                          <span className="truncate block">{section.title}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-900 border-slate-800 min-h-[600px]">
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400">Loading documentation...</p>
                  </div>
                </div>
              ) : selectedSection ? (
                <CardContent className="p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSection(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      ← Back to overview
                    </Button>
                    <Badge variant="outline" className="text-slate-500 border-slate-700">
                      {selectedDoc?.title}
                    </Badge>
                  </div>

                  <h2 className="text-2xl font-bold text-white mb-6">{selectedSection.title}</h2>
                  
                  <div 
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(formatMarkdown(
                        searchQuery 
                          ? highlightText(selectedSection.content, searchQuery)
                          : selectedSection.content
                      ))
                    }}
                  />
                </CardContent>
              ) : selectedDoc ? (
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className={`p-3 rounded-xl ${selectedDoc.color} text-white`}>
                      {selectedDoc.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedDoc.title}</h2>
                      <p className="text-slate-400">{selectedDoc.description}</p>
                    </div>
                  </div>

                  {/* Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSections
                      .filter(s => s.level <= 2)
                      .slice(0, 12)
                      .map((section, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSection(section)}
                        className="text-left p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-red-500/50 hover:bg-slate-800 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors">
                            {section.title}
                          </h3>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                        </div>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {section.content.slice(0, 100)}...
                        </p>
                      </button>
                    ))}
                  </div>

                  {filteredSections.filter(s => s.level <= 2).length > 12 && (
                    <p className="text-center text-slate-500 mt-6">
                      + {filteredSections.filter(s => s.level <= 2).length - 12} more sections
                    </p>
                  )}
                </CardContent>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <p className="text-slate-400">Select a document to view</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
