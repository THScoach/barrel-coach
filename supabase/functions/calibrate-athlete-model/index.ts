import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwingData {
  b1_score: number;
  b2_score: number;
  b3_score: number;
  b4_score: number;
  v_bat_actual_mph: number;
}

/**
 * Fit a multivariate linear regression using ordinary least squares
 * Returns coefficients for: v_bat = β₀ + β₁*B1 + β₂*B2 + β₃*B3 + β₄*B4
 */
function fitLinearRegression(swings: SwingData[]): {
  beta_0: number;
  beta_1: number;
  beta_2: number;
  beta_3: number;
  beta_4: number;
  r_squared: number;
} {
  const n = swings.length;
  
  // Build design matrix X and target vector y
  // X = [1, b1, b2, b3, b4] for each swing
  // y = v_bat_actual for each swing
  const X: number[][] = swings.map(s => [1, s.b1_score, s.b2_score, s.b3_score, s.b4_score]);
  const y: number[] = swings.map(s => s.v_bat_actual_mph);
  
  // Compute X'X (transpose of X times X)
  const XtX: number[][] = [];
  for (let i = 0; i < 5; i++) {
    XtX[i] = [];
    for (let j = 0; j < 5; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }
  
  // Compute X'y
  const Xty: number[] = [];
  for (let i = 0; i < 5; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }
  
  // Solve (X'X)β = X'y using Gaussian elimination with partial pivoting
  const augmented = XtX.map((row, i) => [...row, Xty[i]]);
  
  // Forward elimination
  for (let col = 0; col < 5; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < 5; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    
    // Eliminate
    for (let row = col + 1; row < 5; row++) {
      if (augmented[col][col] !== 0) {
        const factor = augmented[row][col] / augmented[col][col];
        for (let j = col; j <= 5; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }
  
  // Back substitution
  const beta: number[] = new Array(5).fill(0);
  for (let i = 4; i >= 0; i--) {
    let sum = augmented[i][5];
    for (let j = i + 1; j < 5; j++) {
      sum -= augmented[i][j] * beta[j];
    }
    beta[i] = augmented[i][i] !== 0 ? sum / augmented[i][i] : 0;
  }
  
  // Calculate R-squared
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = beta[0] + beta[1] * X[i][1] + beta[2] * X[i][2] + 
                  beta[3] * X[i][3] + beta[4] * X[i][4];
    ssRes += Math.pow(y[i] - yPred, 2);
  }
  
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  
  return {
    beta_0: beta[0],
    beta_1: beta[1],
    beta_2: beta[2],
    beta_3: beta[3],
    beta_4: beta[4],
    r_squared: Math.max(0, Math.min(1, rSquared)),
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { playerId, minSwings = 5 } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: 'playerId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all swing scores for the player
    const { data: swings, error: swingsError } = await supabase
      .from('swing_4b_scores')
      .select('b1_score, b2_score, b3_score, b4_score, v_bat_actual_mph')
      .eq('player_id', playerId)
      .not('v_bat_actual_mph', 'is', null)
      .not('b1_score', 'is', null)
      .not('b2_score', 'is', null)
      .not('b3_score', 'is', null)
      .not('b4_score', 'is', null);

    if (swingsError) {
      console.error('Error fetching swings:', swingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch swing data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!swings || swings.length < minSwings) {
      return new Response(
        JSON.stringify({ 
          error: `Need at least ${minSwings} swings to calibrate model`,
          currentCount: swings?.length || 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fit the regression model
    const modelCoeffs = fitLinearRegression(swings as SwingData[]);

    // Upsert the athlete model
    const modelData = {
      player_id: playerId,
      beta_0: modelCoeffs.beta_0,
      beta_1: modelCoeffs.beta_1,
      beta_2: modelCoeffs.beta_2,
      beta_3: modelCoeffs.beta_3,
      beta_4: modelCoeffs.beta_4,
      r_squared: modelCoeffs.r_squared,
      sample_count: swings.length,
      calibrated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    };

    const { data: upsertedModel, error: upsertError } = await supabase
      .from('athlete_krs_models')
      .upsert(modelData, { onConflict: 'player_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting model:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save athlete model', details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Interpret the coefficients
    const interpretation = {
      baselineBatSpeed: modelCoeffs.beta_0,
      b1Contribution: `+${(modelCoeffs.beta_1 * 10).toFixed(1)} mph per 10 KRS points in B1 (Rotational Foundation)`,
      b2Contribution: `+${(modelCoeffs.beta_2 * 10).toFixed(1)} mph per 10 KRS points in B2 (Hip Load)`,
      b3Contribution: `+${(modelCoeffs.beta_3 * 10).toFixed(1)} mph per 10 KRS points in B3 (Ground Connection)`,
      b4Contribution: `+${(modelCoeffs.beta_4 * 10).toFixed(1)} mph per 10 KRS points in B4 (Temporal Sync)`,
      modelQuality: modelCoeffs.r_squared > 0.7 ? 'Strong' : 
                    modelCoeffs.r_squared > 0.4 ? 'Moderate' : 'Weak',
    };

    return new Response(
      JSON.stringify({
        success: true,
        model: upsertedModel,
        interpretation,
        sampleCount: swings.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in calibrate-athlete-model:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
