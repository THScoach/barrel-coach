import { supabase } from "@/integrations/supabase/client";

// Types for the capture system
export interface CaptureSession {
  id: string;
  player_id: string | null;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
  total_swings: number;
  status: 'active' | 'completed' | 'cancelled';
  environment: string | null;
  notes: string | null;
}

export interface CapturedSwing {
  id: string;
  session_id: string;
  player_id: string | null;
  swing_number: number;
  video_path: string | null;
  video_url: string | null;
  thumbnail_path: string | null;
  bat_speed_mph: number | null;
  attack_angle_deg: number | null;
  hand_speed_mph: number | null;
  time_to_contact_ms: number | null;
  tempo_score: number | null;
  motor_profile_prediction: 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN' | 'UNKNOWN' | null;
  efficiency_rating: number | null;
  raw_sensor_data: Record<string, unknown> | null;
  analysis_result: Record<string, unknown> | null;
  peak_acceleration_g: number | null;
  captured_at: string;
  analyzed_at: string | null;
}

export interface SwingMetrics {
  bat_speed_mph: number;
  attack_angle_deg: number;
  hand_speed_mph: number;
  time_to_contact_ms: number;
  tempo_score: number;
  motor_profile_prediction: 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN' | 'UNKNOWN';
  efficiency_rating: number;
  peak_acceleration_g: number;
}

const STORAGE_BUCKET = 'swing-videos';

// Type-safe helper for new tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => supabase.from(table as any);

/**
 * CatchingBarrelsService - Manages session and swing data for the capture system
 */
export class CatchingBarrelsService {
  private userId: string | null = null;
  private playerId: string | null = null;

  async initialize(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;

    if (user?.email) {
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('email', user.email)
        .single();
      this.playerId = player?.id || null;
    }
  }

  /**
   * Start a new capture session
   */
  async startSession(environment?: string): Promise<CaptureSession | null> {
    if (!this.userId) {
      await this.initialize();
    }

    const { data, error } = await fromTable('capture_sessions')
      .insert({
        user_id: this.userId,
        player_id: this.playerId,
        environment: environment || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to start session:', error);
      return null;
    }

    return data as unknown as CaptureSession;
  }

  /**
   * Stop an active session
   */
  async stopSession(sessionId: string): Promise<CaptureSession | null> {
    const { data, error } = await fromTable('capture_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Failed to stop session:', error);
      return null;
    }

    return data as unknown as CaptureSession;
  }

  /**
   * Get the current active session
   */
  async getActiveSession(): Promise<CaptureSession | null> {
    if (!this.userId) {
      await this.initialize();
    }

    const { data, error } = await fromTable('capture_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data as unknown as CaptureSession;
  }

  /**
   * Get session history
   */
  async getSessionHistory(limit = 20): Promise<CaptureSession[]> {
    if (!this.userId) {
      await this.initialize();
    }

    const { data, error } = await fromTable('capture_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get session history:', error);
      return [];
    }

    return (data || []) as unknown as CaptureSession[];
  }

  /**
   * Upload video to storage and return the path
   */
  async uploadSwingVideo(
    sessionId: string,
    swingNumber: number,
    videoBlob: Blob
  ): Promise<{ path: string; url: string } | null> {
    const timestamp = Date.now();
    const fileName = `${sessionId}/${swingNumber}_${timestamp}.mp4`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, videoBlob, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (error) {
      console.error('Failed to upload video:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  }

  /**
   * Record a new swing with metrics
   */
  async recordSwing(
    sessionId: string,
    swingNumber: number,
    videoPath: string | null,
    videoUrl: string | null,
    metrics: Partial<SwingMetrics>,
    rawSensorData?: Record<string, unknown>
  ): Promise<CapturedSwing | null> {
    const { data, error } = await fromTable('captured_swings')
      .insert({
        session_id: sessionId,
        player_id: this.playerId,
        swing_number: swingNumber,
        video_path: videoPath,
        video_url: videoUrl,
        bat_speed_mph: metrics.bat_speed_mph || null,
        attack_angle_deg: metrics.attack_angle_deg || null,
        hand_speed_mph: metrics.hand_speed_mph || null,
        time_to_contact_ms: metrics.time_to_contact_ms || null,
        tempo_score: metrics.tempo_score || null,
        motor_profile_prediction: metrics.motor_profile_prediction || null,
        efficiency_rating: metrics.efficiency_rating || null,
        peak_acceleration_g: metrics.peak_acceleration_g || null,
        raw_sensor_data: rawSensorData || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to record swing:', error);
      return null;
    }

    // Update session swing count
    await fromTable('capture_sessions')
      .update({ total_swings: swingNumber })
      .eq('id', sessionId);

    return data as unknown as CapturedSwing;
  }

  /**
   * Get swings for a session
   */
  async getSessionSwings(sessionId: string): Promise<CapturedSwing[]> {
    const { data, error } = await fromTable('captured_swings')
      .select('*')
      .eq('session_id', sessionId)
      .order('swing_number', { ascending: true });

    if (error) {
      console.error('Failed to get session swings:', error);
      return [];
    }

    return (data || []) as unknown as CapturedSwing[];
  }

  /**
   * Calculate metrics from raw sensor data using SwingMetricsProcessor
   */
  calculateMetrics(peakAcceleration: number): SwingMetrics {
    // Import processor functions for real calculations
    const { calculateTempoScore, calculateEfficiencyRating, classifyMotorProfile } = require('./SwingMetricsProcessor');
    
    // Estimate bat speed from acceleration (simplified model)
    const batSpeed = Math.min(95, Math.max(40, peakAcceleration * 5.5 + 5));
    const handSpeed = batSpeed * 0.38;
    const attackAngle = 10 + (Math.random() - 0.5) * 8;
    const triggerToImpact = Math.max(120, 180 - peakAcceleration * 3);
    
    // Use real processor for tempo and efficiency
    const tempoScore = calculateTempoScore(triggerToImpact, '12U');
    const efficiencyRating = calculateEfficiencyRating({
      speedEfficiency: 75 + (peakAcceleration - 8) * 2,
      approachAngle: attackAngle,
      distanceInZone: 12,
      handCastDistance: 6,
    });
    
    // Use real motor profile classification
    const { profile } = classifyMotorProfile({
      speedEfficiency: 75 + (peakAcceleration - 8) * 2,
      handCastDistance: 6,
      distanceInZone: 12,
      maxBarrelSpeed: batSpeed,
      triggerToImpact: triggerToImpact,
    });

    return {
      bat_speed_mph: Math.round(batSpeed * 10) / 10,
      attack_angle_deg: Math.round(attackAngle * 10) / 10,
      hand_speed_mph: Math.round(handSpeed * 10) / 10,
      time_to_contact_ms: Math.round(triggerToImpact),
      tempo_score: tempoScore,
      motor_profile_prediction: profile,
      efficiency_rating: Math.round(efficiencyRating),
      peak_acceleration_g: Math.round(peakAcceleration * 100) / 100,
    };
  }
}

// Export singleton instance for backward compatibility
export const catchingBarrelsService = new CatchingBarrelsService();
