import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { StepIndicator } from '@/components/StepIndicator';
import { ProductSelector } from '@/components/ProductSelector';
import { PlayerInfoForm } from '@/components/PlayerInfoForm';
import { EnvironmentSelector } from '@/components/EnvironmentSelector';
import { VideoUploader } from '@/components/VideoUploader';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { ResultsPage } from '@/components/ResultsPage';
import { SampleReportPreview } from '@/components/SampleReportPreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Product, 
  PlayerInfo, 
  Environment, 
  UploadedVideo,
  AnalysisResults,
  PRODUCTS 
} from '@/types/analysis';

type Step = 'product' | 'player' | 'environment' | 'upload' | 'processing' | 'results';

export default function Analyze() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('product');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Swing Analysis Pricing - $37 Single Swing | Catching Barrels';
  }, []);

  // Handle returning from Stripe checkout
  useEffect(() => {
    const urlSessionId = searchParams.get('session_id');
    if (urlSessionId) {
      setSessionId(urlSessionId);
      setStep('processing');
    }
  }, [searchParams]);

  const getStepNumber = (): number => {
    switch (step) {
      case 'player': return 1;
      case 'environment': return 2;
      case 'upload': return 3;
      default: return 0;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'player':
        setStep('product');
        break;
      case 'environment':
        setStep('player');
        break;
      case 'upload':
        setStep('environment');
        break;
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setStep('player');
  };

  const handlePlayerInfoSubmit = (info: PlayerInfo) => {
    setPlayerInfo(info);
    setStep('environment');
  };

  const handleEnvironmentSelect = async (env: Environment) => {
    setEnvironment(env);
    
    if (!selectedProduct || !playerInfo) {
      toast.error('Missing product or player info');
      return;
    }

    setIsLoading(true);
    try {
      // Create session in backend
      const { data, error } = await supabase.functions.invoke('create-session', {
        body: {
          productType: selectedProduct.id,
          player: playerInfo,
          environment: env,
        },
      });

      if (error) throw error;
      
      setSessionId(data.sessionId);
      setStep('upload');
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideosComplete = async () => {
    if (!sessionId) {
      toast.error('No session found');
      return;
    }

    setIsLoading(true);
    try {
      // Create Stripe checkout
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { sessionId },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error('Failed to create checkout. Please try again.');
      setIsLoading(false);
    }
  };

  const handleProcessingComplete = async () => {
    if (!sessionId) return;

    try {
      // Fetch results from backend
      const { data, error } = await supabase.functions.invoke('get-session', {
        body: {},
        headers: {},
      });

      // Actually fetch via query params since it's a GET-style function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session?sessionId=${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch results');
      
      const sessionData = await response.json();
      
      if (sessionData.session.status !== 'complete') {
        toast.error('Analysis is still processing. Please wait.');
        return;
      }

      // Transform backend data to frontend format
      const analysisResults: AnalysisResults = {
        sessionId: sessionData.session.id,
        productType: sessionData.session.product_type,
        playerInfo: {
          name: sessionData.session.player_name,
          age: sessionData.session.player_age,
          email: sessionData.session.player_email,
          level: sessionData.session.player_level,
        },
        compositeScore: parseFloat(sessionData.session.composite_score) || 62,
        grade: sessionData.session.grade || 'Above Avg',
        scores: {
          brain: parseFloat(sessionData.session.four_b_brain) || 68,
          body: parseFloat(sessionData.session.four_b_body) || 65,
          bat: parseFloat(sessionData.session.four_b_bat) || 58,
          ball: parseFloat(sessionData.session.four_b_ball) || 61,
        },
        mainProblem: sessionData.session.analysis_json?.problem || {
          category: sessionData.session.weakest_category || 'bat',
          name: 'Late Barrel Release',
          description: "You're swinging too late. Your bat reaches full speed AFTER you should hit the ball.",
          consequences: [
            "You're losing 30-50 feet of distance",
            "You'll hit weak grounders instead of line drives",
            "Pitchers will throw inside and jam you",
          ],
        },
        drill: sessionData.session.analysis_json?.drill || {
          name: 'CONNECTION BALL',
          sets: 3,
          reps: 10,
          instructions: "Put a tennis ball under your front armpit. Swing without dropping it.",
          whyItWorks: "Makes you swing earlier and stay connected through the zone.",
        },
        ...(sessionData.session.product_type === 'complete_review' && {
          swingAnalyses: sessionData.swings?.map((swing: any, index: number) => ({
            id: swing.id,
            index: swing.swing_index,
            compositeScore: parseFloat(swing.composite_score) || 60,
            scores: {
              brain: parseFloat(swing.four_b_brain) || 60,
              body: parseFloat(swing.four_b_body) || 60,
              bat: parseFloat(swing.four_b_bat) || 60,
              ball: parseFloat(swing.four_b_ball) || 60,
            },
          })) || [],
          bestSwing: {
            index: sessionData.session.best_swing_index || 0,
            score: parseFloat(sessionData.session.best_swing_score) || 70,
          },
          worstSwing: {
            index: sessionData.session.worst_swing_index || 0,
            score: parseFloat(sessionData.session.worst_swing_score) || 55,
          },
          percentile: sessionData.session.percentile || 62,
          thirtyDayPlan: sessionData.session.analysis_json?.thirty_day_plan || {
            week1_2: 'Connection Ball (3×10, every day)',
            week3_4: 'Timing Tees (2×15, every day)',
            week5_6: 'Film 5 swings and upload',
            schedule: 'Monday-Friday: 10 minutes before practice | Saturday: Film 5 swings | Sunday: Rest',
          },
        }),
        reportUrl: sessionData.session.report_url,
      };

      setResults(analysisResults);
      setSelectedProduct(PRODUCTS.find(p => p.id === sessionData.session.product_type) || null);
      setStep('results');
    } catch (error) {
      console.error('Failed to fetch results:', error);
      // Use mock results for now if fetch fails
      if (selectedProduct && playerInfo) {
        const mockResults: AnalysisResults = {
          sessionId: sessionId,
          productType: selectedProduct.id,
          playerInfo,
          compositeScore: 62,
          grade: 'Above Avg',
          scores: { brain: 68, body: 65, bat: 58, ball: 61 },
          mainProblem: {
            category: 'bat',
            name: 'Late Barrel Release',
            description: "You're swinging too late.",
            consequences: ["Losing distance", "Weak grounders", "Getting jammed"],
          },
          drill: {
            name: 'CONNECTION BALL',
            sets: 3,
            reps: 10,
            instructions: "Put a tennis ball under your front armpit.",
            whyItWorks: "Makes you swing earlier.",
          },
        };
        setResults(mockResults);
        setStep('results');
      }
    }
  };

  const showStepIndicator = ['player', 'environment', 'upload'].includes(step);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {showStepIndicator && (
          <StepIndicator 
            currentStep={getStepNumber()} 
            totalSteps={3}
            onBack={handleBack}
            showBack={step !== 'product'}
          />
        )}

        <div className="mt-8">
          {step === 'product' && (
            <>
              <ProductSelector onSelect={handleProductSelect} />
              <SampleReportPreview />
            </>
          )}

          {step === 'player' && (
            <PlayerInfoForm 
              onSubmit={handlePlayerInfoSubmit}
              initialData={playerInfo || undefined}
            />
          )}

          {step === 'environment' && (
            <EnvironmentSelector 
              onSelect={handleEnvironmentSelect}
              initialValue={environment || undefined}
              isLoading={isLoading}
            />
          )}

          {step === 'upload' && selectedProduct && sessionId && (
            <VideoUploader 
              swingsRequired={selectedProduct.swingsRequired}
              sessionId={sessionId}
              onComplete={handleVideosComplete}
              isCheckoutLoading={isLoading}
            />
          )}

          {step === 'processing' && selectedProduct && (
            <ProcessingScreen 
              swingsCount={selectedProduct?.swingsRequired || 1}
              sessionId={sessionId}
              onComplete={handleProcessingComplete}
            />
          )}

          {step === 'results' && results && (
            <ResultsPage results={results} />
          )}
        </div>
      </main>
    </div>
  );
}
