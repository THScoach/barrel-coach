/**
 * Diamond Kinetics API Client
 * ============================================================================
 * Communicates with the Diamond Kinetics API to fetch batting sessions and swings
 * Uses OAuth tokens stored in dk_accounts table
 */

// Diamond Kinetics API Types
export interface DKConfig {
  baseUrl: string;
  accessToken: string;
  refreshToken?: string;
}

export interface DKUser {
  uuid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  created: string;
}

export interface DKSession {
  uuid: string;
  created: string;
  lastUpdated: string;
  deleted: boolean;
  sessionType?: 'batting' | 'pitching';
  notes?: string;
  swings: {
    countTotal: number;
    countDeleted: number;
    countViewable: number;
    maxLastUpdated?: string;
    data?: DKSwing[];
  };
}

export interface DKSwing {
  uuid: string;
  created: string;
  lastUpdated: string;
  deleted: boolean;

  // Core Metrics (from DK sensor)
  maxBarrelSpeed: number | null;           // mph - "Bat Speed"
  maxHandSpeed: number | null;             // mph
  approachAngle: number | null;            // degrees - "Attack Angle" / swing plane steepness
  maxAcceleration: number | null;          // g-force
  impactMomentum: number | null;           // momentum at contact
  appliedPower: number | null;             // power metric
  speedEfficiency: number | null;          // hand-to-barrel transfer %
  triggerToImpact: number | null;          // milliseconds
  handCastDistance: number | null;         // inches
  distanceInZone: number | null;           // inches - time in hitting zone
  handPath: number | null;                 // degrees

  // Additional plane metrics
  swingPlaneHeadingAngle: number | null;   // attack direction
  swingPlaneTiltAngle: number | null;      // plane tilt

  // Impact location
  impactLocationX: number | null;
  impactLocationY: number | null;
  impactLocationZ: number | null;

  // 3D Data (if available with API tier)
  swingPlaneData?: {
    positions?: Array<{ x: number; y: number; z: number; timestamp: number }>;
    rotations?: Array<{ pitch: number; yaw: number; roll: number; timestamp: number }>;
  };

  // Video reference
  videoUrl?: string;
  thumbnailUrl?: string;
}

export interface DKSessionsResponse {
  sessions: DKSession[];
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface DKSwingsResponse {
  swings: DKSwing[];
  sessionUuid: string;
}

export interface DKTokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Diamond Kinetics API Client
 */
export class DiamondKineticsAPI {
  private config: DKConfig;
  private static readonly DEFAULT_BASE_URL = 'https://api.diamondkinetics.com';

  constructor(config: Partial<DKConfig> & { accessToken: string }) {
    this.config = {
      baseUrl: config.baseUrl || DiamondKineticsAPI.DEFAULT_BASE_URL,
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
    };
  }

  /**
   * Make authenticated request to DK API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DK API] Error ${response.status}: ${errorText}`);
      
      if (response.status === 401) {
        throw new DKAuthError('Authentication failed - token may be expired');
      }
      
      throw new DKAPIError(`DK API Error: ${response.status}`, response.status, errorText);
    }

    return response.json();
  }

  /**
   * Get current authenticated user info
   */
  async getCurrentUser(): Promise<DKUser> {
    return this.request<DKUser>('/v3/users/me');
  }

  /**
   * Get all batting sessions for a user
   */
  async getBattingSessions(
    userId: string,
    options?: {
      deleted?: boolean;
      sort?: string;
      page?: number;
      perPage?: number;
      since?: string; // ISO date to filter sessions updated after this date
    }
  ): Promise<DKSession[]> {
    const params = new URLSearchParams();
    
    if (options?.deleted !== undefined) {
      params.append('deleted', String(options.deleted));
    }
    if (options?.sort) {
      params.append('sort', options.sort);
    }
    if (options?.page) {
      params.append('page', String(options.page));
    }
    if (options?.perPage) {
      params.append('perPage', String(options.perPage));
    }
    if (options?.since) {
      params.append('since', options.since);
    }

    const queryString = params.toString();
    const endpoint = `/v3/users/${userId}/battingSessions${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<DKSession[] | DKSessionsResponse>(endpoint);
    
    // Handle both array and paginated response formats
    return Array.isArray(response) ? response : response.sessions;
  }

  /**
   * Get a single batting session with optional embedded swings
   */
  async getBattingSession(
    sessionUuid: string,
    embedSwings = false
  ): Promise<DKSession> {
    const params = new URLSearchParams();
    if (embedSwings) {
      params.append('embed', 'swings');
    }
    
    const queryString = params.toString();
    const endpoint = `/v3/battingSessions/${sessionUuid}${queryString ? `?${queryString}` : ''}`;
    
    return this.request<DKSession>(endpoint);
  }

  /**
   * Get swings for a specific session
   */
  async getSwings(
    sessionUuid: string,
    options?: {
      sort?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<DKSwing[]> {
    const params = new URLSearchParams();
    
    if (options?.sort) {
      params.append('sort', options.sort);
    }
    if (options?.page) {
      params.append('page', String(options.page));
    }
    if (options?.perPage) {
      params.append('perPage', String(options.perPage));
    }

    const queryString = params.toString();
    const endpoint = `/v3/battingSessions/${sessionUuid}/swings${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request<DKSwing[] | DKSwingsResponse>(endpoint);
    
    // Handle both array and wrapped response formats
    return Array.isArray(response) ? response : response.swings;
  }

  /**
   * Get a single swing with full details
   */
  async getSwing(swingUuid: string): Promise<DKSwing> {
    return this.request<DKSwing>(`/v3/swings/${swingUuid}`);
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string
  ): Promise<DKTokenRefreshResponse> {
    if (!this.config.refreshToken) {
      throw new DKAuthError('No refresh token available');
    }

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new DKAuthError(`Token refresh failed: ${errorText}`);
    }

    const tokens = await response.json() as DKTokenRefreshResponse;
    
    // Update internal config with new tokens
    this.config.accessToken = tokens.access_token;
    if (tokens.refresh_token) {
      this.config.refreshToken = tokens.refresh_token;
    }

    return tokens;
  }

  /**
   * Get the current access token (for storage updates)
   */
  getAccessToken(): string {
    return this.config.accessToken;
  }

  /**
   * Get the current refresh token (for storage updates)
   */
  getRefreshToken(): string | undefined {
    return this.config.refreshToken;
  }
}

/**
 * Custom error for DK API errors
 */
export class DKAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'DKAPIError';
  }
}

/**
 * Custom error for authentication issues
 */
export class DKAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DKAuthError';
  }
}

/**
 * Map DK swing to normalized format for sensor_swings table
 */
export function mapDKSwingToNormalized(
  dkSwing: DKSwing,
  playerId: string,
  sessionId: string,
  swingNumber: number
): Record<string, unknown> {
  const batSpeed = dkSwing.maxBarrelSpeed;
  const handSpeed = dkSwing.maxHandSpeed;
  const ratio = batSpeed && handSpeed && batSpeed > 0 
    ? Math.round((handSpeed / batSpeed) * 100) / 100 
    : null;

  return {
    player_id: playerId,
    session_id: sessionId,
    dk_swing_id: dkSwing.uuid,
    occurred_at: dkSwing.created,
    swing_number: swingNumber,
    
    // Core metrics
    bat_speed_mph: batSpeed ? Math.round(batSpeed * 10) / 10 : null,
    hand_speed_mph: handSpeed ? Math.round(handSpeed * 10) / 10 : null,
    trigger_to_impact_ms: dkSwing.triggerToImpact ? Math.round(dkSwing.triggerToImpact) : null,
    attack_angle_deg: dkSwing.approachAngle ? Math.round(dkSwing.approachAngle * 10) / 10 : null,
    attack_direction_deg: dkSwing.swingPlaneHeadingAngle ? Math.round(dkSwing.swingPlaneHeadingAngle * 10) / 10 : null,
    swing_plane_tilt_deg: dkSwing.swingPlaneTiltAngle ? Math.round(dkSwing.swingPlaneTiltAngle * 10) / 10 : null,
    
    // Impact location
    impact_location_x: dkSwing.impactLocationX,
    impact_location_y: dkSwing.impactLocationY,
    impact_location_z: dkSwing.impactLocationZ,
    
    // Power metrics
    applied_power: dkSwing.appliedPower ? Math.round(dkSwing.appliedPower * 10) / 10 : null,
    max_acceleration: dkSwing.maxAcceleration ? Math.round(dkSwing.maxAcceleration * 10) / 10 : null,
    
    // Derived
    hand_to_bat_ratio: ratio,
    
    // Validity
    is_valid: batSpeed !== null && batSpeed >= 25, // Filter waggles
    
    // Raw data for debugging
    raw_dk_data: {
      data: dkSwing,
      meta: {
        synced_at: new Date().toISOString(),
        source: 'dk_api_fetch',
      },
    },
  };
}
