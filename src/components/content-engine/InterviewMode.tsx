import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Mic, Video, Square, Circle, RotateCcw, Check, 
  ChevronRight, Play, Pause, SkipForward, X, Sparkles,
  HelpCircle, Clock, Lightbulb
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InterviewQuestion {
  id: string;
  topic: string;
  question: string;
  context: string;
  difficulty: 'easy' | 'medium' | 'deep';
}

// Question bank based on Coach Rick's topics
const QUESTION_BANK: InterviewQuestion[] = [
  // Motor Profiles
  { id: 'mp1', topic: 'motor_profile', question: "What's the biggest mistake you see Spinners make?", context: "Discuss the common compensation patterns for Spinner types", difficulty: 'easy' },
  { id: 'mp2', topic: 'motor_profile', question: "Explain Motor Profiles to a 12-year-old", context: "Simple analogy for different swing types", difficulty: 'easy' },
  { id: 'mp3', topic: 'motor_profile', question: "How do you identify a Slingshotter vs a Whipper in the first 3 swings?", context: "Quick identification cues", difficulty: 'medium' },
  { id: 'mp4', topic: 'motor_profile', question: "Why can't a natural Spinner swing like Judge?", context: "Anatomy and physics constraints", difficulty: 'deep' },
  
  // Transfer Ratio
  { id: 'tr1', topic: 'transfer_ratio', question: "What is Transfer Ratio in plain English?", context: "Core concept explanation", difficulty: 'easy' },
  { id: 'tr2', topic: 'transfer_ratio', question: "Why is 1.5-1.8 the 'elite' Transfer Ratio range?", context: "The biomechanics behind the numbers", difficulty: 'medium' },
  { id: 'tr3', topic: 'transfer_ratio', question: "How do you fix a player with a 1.2 Transfer Ratio?", context: "Training approach for low transfer", difficulty: 'deep' },
  
  // 4B Framework
  { id: '4b1', topic: '4b_framework', question: "Walk through the 4B Framework - Ball, Bat, Body, Brain", context: "Introduce the interconnected pillars", difficulty: 'easy' },
  { id: '4b2', topic: '4b_framework', question: "Why do most coaches only focus on 'Bat' in the 4B?", context: "Industry critique and gap", difficulty: 'medium' },
  { id: '4b3', topic: '4b_framework', question: "How does the 'Brain' pillar affect a player's swing in game vs practice?", context: "Mental game integration", difficulty: 'deep' },
  
  // Data vs Experience
  { id: 'de1', topic: 'experience_gap', question: "What do the data analysts miss that you see?", context: "Experience gap explanation", difficulty: 'easy' },
  { id: 'de2', topic: 'experience_gap', question: "React: 'Just look at the numbers, they don't lie'", context: "Critique of pure data approach", difficulty: 'medium' },
  { id: 'de3', topic: 'experience_gap', question: "Tell me about a player whose data looked bad but you knew they'd figure it out", context: "Story showing pattern recognition", difficulty: 'deep' },
  
  // Tempo/Timing
  { id: 'tt1', topic: 'tempo', question: "What is the 'timing gap' and why does it matter?", context: "10-18% timing gap concept", difficulty: 'easy' },
  { id: 'tt2', topic: 'tempo', question: "How do you know when a player's timing is actually broken vs just off that day?", context: "Pattern recognition in timing issues", difficulty: 'medium' },
  
  // Player Stories
  { id: 'ps1', topic: 'player_story', question: "Tell the story of a player who completely transformed their swing", context: "Transformation narrative", difficulty: 'medium' },
  { id: 'ps2', topic: 'player_story', question: "What's the most common thing parents get wrong about their kid's swing?", context: "Parent education moment", difficulty: 'easy' },
  
  // Controversial Takes
  { id: 'ct1', topic: 'data_critique', question: "What's wrong with the Driveline approach?", context: "Industry critique", difficulty: 'medium' },
  { id: 'ct2', topic: 'unlock_vs_add', question: "Explain 'We don't add, we unlock' - what does that actually mean?", context: "Core philosophy differentiation", difficulty: 'easy' },
  { id: 'ct3', topic: 'unlock_vs_add', question: "Why do so many coaches try to 'add' mechanics that hurt players?", context: "Industry problem explanation", difficulty: 'deep' },
];

interface InterviewModeProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function InterviewMode({ onComplete, onCancel }: InterviewModeProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [phase, setPhase] = useState<'intro' | 'recording' | 'review' | 'complete'>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedQuestions, setSelectedQuestions] = useState<InterviewQuestion[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Map<string, { blob: Blob; duration: number }>>(new Map());
  const [cameraActive, setCameraActive] = useState(false);

  // Fetch topics that haven't been posted recently
  const { data: topicsData } = useQuery({
    queryKey: ['content-topics-gaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_topics')
        .select('name, last_posted_at')
        .order('last_posted_at', { ascending: true, nullsFirst: true })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  // Select questions based on topic gaps
  useEffect(() => {
    const gapTopics = topicsData?.map(t => t.name) || [];
    
    // Prioritize questions from topics with gaps
    let prioritized = QUESTION_BANK.filter(q => gapTopics.includes(q.topic));
    
    // Add variety with other questions
    const others = QUESTION_BANK.filter(q => !gapTopics.includes(q.topic));
    
    // Mix: 5 from gaps, 3 from others
    const selected = [
      ...prioritized.slice(0, 5),
      ...others.sort(() => Math.random() - 0.5).slice(0, 3),
    ].slice(0, 8);
    
    // Shuffle
    setSelectedQuestions(selected.sort(() => Math.random() - 0.5));
  }, [topicsData]);

  const currentQuestion = selectedQuestions[questionIndex];
  const progress = selectedQuestions.length > 0 
    ? ((questionIndex + 1) / selectedQuestions.length) * 100 
    : 0;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      
      // Save recording
      if (currentQuestion) {
        setRecordings(prev => {
          const next = new Map(prev);
          next.set(currentQuestion.id, { blob, duration: recordingTime });
          return next;
        });
      }
      
      setIsPreviewing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.muted = false;
      }
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setRecordingTime(0);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, [currentQuestion, recordingTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const skipQuestion = useCallback(() => {
    if (questionIndex < selectedQuestions.length - 1) {
      setQuestionIndex(prev => prev + 1);
      setIsPreviewing(false);
      setRecordingTime(0);
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
    }
  }, [questionIndex, selectedQuestions.length]);

  const nextQuestion = useCallback(() => {
    if (questionIndex < selectedQuestions.length - 1) {
      setQuestionIndex(prev => prev + 1);
      setIsPreviewing(false);
      setRecordingTime(0);
      if (videoRef.current && streamRef.current) {
        videoRef.current.src = '';
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
    } else {
      // All questions done
      setPhase('review');
      stopCamera();
    }
  }, [questionIndex, selectedQuestions.length, stopCamera]);

  const retakeQuestion = useCallback(() => {
    setIsPreviewing(false);
    setRecordingTime(0);
    if (currentQuestion) {
      setRecordings(prev => {
        const next = new Map(prev);
        next.delete(currentQuestion.id);
        return next;
      });
    }
    if (videoRef.current && streamRef.current) {
      videoRef.current.src = '';
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play();
    }
  }, [currentQuestion]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const uploads: Promise<void>[] = [];
      
      for (const [questionId, { blob, duration }] of recordings) {
        const question = selectedQuestions.find(q => q.id === questionId);
        if (!question) continue;
        
        const timestamp = Date.now();
        const fileName = `interview-${questionId}-${timestamp}.webm`;
        
        uploads.push((async () => {
          // Upload video
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('content-engine')
            .upload(fileName, blob, { contentType: 'video/webm' });
          
          if (uploadError) throw uploadError;
          
          // Create content item with interview context
          const { data: contentItem, error: contentError } = await supabase
            .from('content_items')
            .insert({
              source_type: 'video',
              status: 'processing',
              media_url: uploadData.path,
              media_duration_seconds: duration,
              topics: [question.topic],
              source_metadata: { 
                interview_mode: true,
                question: question.question,
                question_context: question.context,
                question_topic: question.topic,
              },
            })
            .select()
            .single();
          
          if (contentError) throw contentError;
          
          // Trigger processing
          await supabase.functions.invoke('process-content', {
            body: { content_item_id: contentItem.id },
          });
        })());
      }
      
      await Promise.all(uploads);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast.success(`${recordings.size} recordings uploaded and processing!`);
      setPhase('complete');
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload some recordings');
    },
  });

  const startInterview = useCallback(async () => {
    setPhase('recording');
    await startCamera();
  }, [startCamera]);

  const finishInterview = useCallback(() => {
    uploadMutation.mutate();
  }, [uploadMutation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopCamera]);

  // Intro phase
  if (phase === 'intro') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Interview Mode</CardTitle>
              <CardDescription>
                15 minutes → 10+ pieces of content
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <Sparkles className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">AI-Generated Questions</p>
              <p className="text-sm text-muted-foreground">
                Based on topics you haven't covered recently
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Video className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">Natural Answers</p>
              <p className="text-sm text-muted-foreground">
                Talk like you're explaining to a parent at the field
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <Lightbulb className="h-5 w-5 text-primary mb-2" />
              <p className="font-medium">Auto-Processed</p>
              <p className="text-sm text-muted-foreground">
                Each answer becomes multiple content pieces
              </p>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="font-medium mb-2">Today's Questions ({selectedQuestions.length})</p>
            <div className="space-y-2">
              {selectedQuestions.slice(0, 4).map((q, i) => (
                <div key={q.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">
                    {q.topic.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-muted-foreground truncate">{q.question}</span>
                </div>
              ))}
              {selectedQuestions.length > 4 && (
                <p className="text-xs text-muted-foreground">
                  +{selectedQuestions.length - 4} more questions
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={startInterview} size="lg" className="gap-2">
              <Video className="h-5 w-5" />
              Start Interview
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Recording phase
  if (phase === 'recording' && currentQuestion) {
    return (
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <Progress value={progress} className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {questionIndex + 1} / {selectedQuestions.length}
          </span>
        </div>

        {/* Question prompt */}
        <Card className="border-primary">
          <CardContent className="p-4">
            <Badge variant="outline" className="mb-2">
              {currentQuestion.topic.replace(/_/g, ' ')}
            </Badge>
            <p className="text-xl font-semibold mb-2">
              "{currentQuestion.question}"
            </p>
            <p className="text-sm text-muted-foreground">
              💡 {currentQuestion.context}
            </p>
          </CardContent>
        </Card>

        {/* Video preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            autoPlay={!isPreviewing}
          />
          
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono">{formatTime(recordingTime)}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording && !isPreviewing && (
            <>
              <Button variant="outline" onClick={skipQuestion}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip
              </Button>
              <Button
                onClick={startRecording}
                size="lg"
                variant="destructive"
                className="rounded-full h-16 w-16"
              >
                <Circle className="h-8 w-8 fill-white" />
              </Button>
            </>
          )}
          
          {isRecording && (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16"
            >
              <Square className="h-6 w-6 fill-white" />
            </Button>
          )}
          
          {isPreviewing && (
            <div className="flex gap-3">
              <Button onClick={retakeQuestion} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>
              <Button onClick={nextQuestion}>
                {questionIndex < selectedQuestions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Finish
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Cancel */}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Cancel Interview
          </Button>
        )}
      </div>
    );
  }

  // Review phase
  if (phase === 'review') {
    const answered = Array.from(recordings.keys());
    const totalDuration = Array.from(recordings.values()).reduce((sum, r) => sum + r.duration, 0);
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interview Complete! 🎉</CardTitle>
          <CardDescription>
            {answered.length} questions answered • {formatTime(totalDuration)} total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {selectedQuestions.map(q => {
              const wasAnswered = answered.includes(q.id);
              const recording = recordings.get(q.id);
              
              return (
                <div 
                  key={q.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    wasAnswered ? "bg-green-50 border-green-200" : "bg-muted/50"
                  )}
                >
                  {wasAnswered ? (
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{q.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.topic.replace(/_/g, ' ')}
                      {recording && ` • ${formatTime(recording.duration)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-primary/5 rounded-lg">
            <p className="text-sm font-medium">
              📈 Estimated content output: {answered.length * 3}-{answered.length * 5} pieces
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Each answer will be formatted for multiple platforms
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={finishInterview} 
              size="lg" 
              className="flex-1 gap-2"
              disabled={uploadMutation.isPending || answered.length === 0}
            >
              {uploadMutation.isPending ? (
                <>Processing...</>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Upload & Process All
                </>
              )}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Discard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Complete phase
  if (phase === 'complete') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">All Done!</h3>
          <p className="text-muted-foreground mb-6">
            Your answers are being processed. Check the queue in a few minutes.
          </p>
          <Button onClick={onComplete}>
            Back to Content Engine
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
