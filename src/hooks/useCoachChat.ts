import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WebMessage {
  id: string;
  conversation_id: string;
  role: 'player' | 'assistant';
  content: string;
  rating: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface WebConversation {
  id: string;
  player_id: string | null;
  session_id: string | null;
  is_active: boolean;
  message_count: number;
  last_message_at: string;
}

interface PlayerContext {
  playerId: string;
  playerName: string;
  motorProfile: string | null;
  compositeScore: number | null;
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  level: string | null;
  weakestCategory: string | null;
  recentDrills: string[];
}

interface UseCoachChatReturn {
  messages: WebMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  conversationId: string | null;
  clearChat: () => Promise<void>;
  rateMessage: (messageId: string, rating: 'good' | 'bad' | 'edited', correction?: string) => Promise<void>;
  playerContext: PlayerContext | null;
  isInitializing: boolean;
}

export function useCoachChat(): UseCoachChatReturn {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);

  // Initialize: load player context and existing conversation
  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      setIsInitializing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError('Please log in to chat with Coach Rick');
        setIsInitializing(false);
        return;
      }

      // Load player info
      const { data: player } = await supabase
        .from('players')
        .select('id, name, motor_profile_sensor, level')
        .eq('email', user.email)
        .maybeSingle();

      if (!player) {
        setError('Player profile not found. Please complete your profile first.');
        setIsInitializing(false);
        return;
      }

      // Load latest 4B scores
      const { data: latestScore } = await supabase
        .from('swing_4b_scores')
        .select('brain_score, body_score, bat_score, ball_score, composite_score, weakest_link')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Load recent drill completions
      const { data: recentDrills } = await supabase
        .from('drill_completions')
        .select('drills(name)')
        .eq('player_id', player.id)
        .order('completed_at', { ascending: false })
        .limit(5);

      const context: PlayerContext = {
        playerId: player.id,
        playerName: player.name || 'Player',
        motorProfile: player.motor_profile_sensor,
        compositeScore: latestScore?.composite_score || null,
        brainScore: latestScore?.brain_score || null,
        bodyScore: latestScore?.body_score || null,
        batScore: latestScore?.bat_score || null,
        ballScore: latestScore?.ball_score || null,
        level: player.level,
        weakestCategory: latestScore?.weakest_link || null,
        recentDrills: recentDrills?.map((d: any) => d.drills?.name).filter(Boolean) || [],
      };
      setPlayerContext(context);

      // Get or create conversation
      const conversation = await getOrCreateConversation(player.id);
      if (conversation) {
        setConversationId(conversation.id);
        await loadMessages(conversation.id);
      }
    } catch (err) {
      console.error('Failed to initialize chat:', err);
      setError('Failed to initialize chat');
    } finally {
      setIsInitializing(false);
    }
  };

  const getOrCreateConversation = async (playerId: string): Promise<WebConversation | null> => {
    // Check for existing active conversation
    const { data: existing, error: fetchError } = await supabase
      .from('web_conversations')
      .select('*')
      .eq('player_id', playerId)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching conversation:', fetchError);
    }

    if (existing) return existing as unknown as WebConversation;

    // Create new conversation
    const { data: newConvo, error: createError } = await supabase
      .from('web_conversations')
      .insert({ player_id: playerId })
      .select()
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      return null;
    }

    return newConvo as unknown as WebConversation;
  };

  const loadMessages = async (convoId: string) => {
    const { data, error: loadError } = await supabase
      .from('web_messages')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });

    if (loadError) {
      console.error('Error loading messages:', loadError);
      return;
    }

    setMessages((data || []) as unknown as WebMessage[]);
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !playerContext) {
      toast.error('Chat not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save player message
      const { data: playerMsg, error: saveError } = await supabase
        .from('web_messages')
        .insert({
          conversation_id: conversationId,
          role: 'player',
          content,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Update local messages immediately
      setMessages(prev => [...prev, playerMsg as unknown as WebMessage]);

      // Update conversation
      await supabase
        .from('web_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 1
        })
        .eq('id', conversationId);

      // Call AI endpoint
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('coach-rick-ai-chat', {
        body: {
          message: content,
          history: messages.map(m => ({ role: m.role === 'player' ? 'user' : 'assistant', content: m.content })),
          pageContext: `Player chatting from web portal. ${playerContext.motorProfile ? `Motor Profile: ${playerContext.motorProfile}` : ''} ${playerContext.compositeScore ? `Composite 4B Score: ${playerContext.compositeScore}` : ''} ${playerContext.weakestCategory ? `Weakest area: ${playerContext.weakestCategory}` : ''}`,
          playerContext: {
            name: playerContext.playerName,
            motorProfile: playerContext.motorProfile,
            level: playerContext.level,
            scores: {
              brain: playerContext.brainScore,
              body: playerContext.bodyScore,
              bat: playerContext.batScore,
              ball: playerContext.ballScore,
              composite: playerContext.compositeScore,
            },
            weakestCategory: playerContext.weakestCategory,
            recentDrills: playerContext.recentDrills,
          },
        },
      });

      if (aiError) throw aiError;

      const assistantContent = aiResponse?.response || "Sorry, I couldn't process that. Try again!";

      // Save assistant message
      const { data: assistantMsg, error: assistantError } = await supabase
        .from('web_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent,
          metadata: {
            drills: aiResponse?.drills || [],
          },
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      setMessages(prev => [...prev, assistantMsg as unknown as WebMessage]);

    } catch (err) {
      console.error('Send message error:', err);
      toast.error('Failed to send message');
      setError('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, playerContext, messages]);

  const clearChat = useCallback(async () => {
    if (!conversationId || !playerContext) return;

    try {
      // Mark current conversation as inactive
      await supabase
        .from('web_conversations')
        .update({ is_active: false })
        .eq('id', conversationId);

      // Create a new conversation
      const newConvo = await getOrCreateConversation(playerContext.playerId);
      if (newConvo) {
        setConversationId(newConvo.id);
        setMessages([]);
      }

      toast.success('Chat cleared');
    } catch (err) {
      console.error('Clear chat error:', err);
      toast.error('Failed to clear chat');
    }
  }, [conversationId, playerContext]);

  const rateMessage = useCallback(async (
    messageId: string,
    rating: 'good' | 'bad' | 'edited',
    correction?: string
  ) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;

      // Update message rating
      await supabase
        .from('web_messages')
        .update({ rating })
        .eq('id', messageId);

      // Create rating record
      await supabase
        .from('clawdbot_ratings')
        .insert({
          message_id: messageId,
          rating,
          original_response: message.content,
          corrected_response: correction || null,
        });

      toast.success(`Response marked as ${rating}`);

      // Update local state
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, rating } : m
      ));
    } catch (err) {
      console.error('Rate message error:', err);
      toast.error('Failed to rate message');
    }
  }, [messages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    conversationId,
    clearChat,
    rateMessage,
    playerContext,
    isInitializing,
  };
}
