import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PlayerData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  motorProfile?: string;
  level?: string;
  team?: string;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
  weakestCategory?: string;
  lastSessionDate?: string;
  swingCount?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface UseRickBotReturn {
  messages: Message[];
  isLoading: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  playerData: PlayerData | null;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  toggleVoice: () => void;
  transcript: string;
}

export function useRickBot(): UseRickBotReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [transcript, setTranscript] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setPlayerData(null);

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call RickBot edge function
      const { data, error } = await supabase.functions.invoke('rickbot-command', {
        body: {
          command: content,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      // Add assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || "I couldn't process that command. Try again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // If player data was returned, show the card
      if (data.playerData) {
        setPlayerData(data.playerData);
      }

    } catch (err) {
      console.error('RickBot error:', err);
      toast.error('Failed to process command');
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, something went wrong. Check the logs or try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Call transcription via Lovable AI (Whisper)
      const { data, error } = await supabase.functions.invoke('rickbot-transcribe', {
        body: {
          audio: base64Audio,
          mimeType: audioBlob.type,
        },
      });

      if (error) throw error;

      if (data.text && data.text.trim()) {
        // Send the transcribed text as a command
        await sendMessage(data.text.trim());
      } else {
        toast.error("Couldn't understand that. Try again?");
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
      setTranscript('');
    }
  }, [sendMessage]);

  const toggleVoice = useCallback(async () => {
    if (isListening) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
        streamRef.current = stream;
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? 'audio/webm;codecs=opus' 
            : 'audio/mp4',
        });
        
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { 
              type: mediaRecorder.mimeType 
            });
            await transcribeAudio(audioBlob);
          }
        };
        
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000); // Collect data every second
        setIsListening(true);
        
        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
          }
        }, 30000);
        
      } catch (err) {
        console.error('Microphone error:', err);
        toast.error('Could not access microphone. Please check permissions.');
      }
    }
  }, [isListening, transcribeAudio]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setPlayerData(null);
    setTranscript('');
    toast.success('Chat cleared');
  }, []);

  return {
    messages,
    isLoading,
    isListening,
    isTranscribing,
    playerData,
    sendMessage,
    clearChat,
    toggleVoice,
    transcript,
  };
}
