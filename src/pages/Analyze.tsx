import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StepIndicator } from '@/components/StepIndicator';
import { ProductSelector } from '@/components/ProductSelector';
import { PlayerInfoForm } from '@/components/PlayerInfoForm';
import { EnvironmentSelector } from '@/components/EnvironmentSelector';
import { VideoUploader } from '@/components/VideoUploader';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { ResultsPage } from '@/components/ResultsPage';
import { SampleReportPreview } from '@/components/SampleReportPreview';
import { TrustBadges } from '@/components/TrustBadges';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Clock, Users, Zap, ChevronDown, Target, Sparkles } from 'lucide-react';
import { 
  Product, 
  PlayerInfo, 
  Environment, 
  UploadedVideo,
  AnalysisResults,
  PRODUCTS 
} from '@/types/analysis';

type Step = 'product' | 'player' | 'environment' | 'upload' | 'processing' | 'results';

const trustStats = [
  { icon: Users, value: '1,000+', label: 'Swings Analyzed', gradient: 'from-blue-500 to-cyan-500' },
  { icon: Shield, value: '400+', label: 'College Commits', gradient: 'from-emerald-500 to-green-500' },
  { icon: Zap, value: '78+', label: 'Pro Players', gradient: 'from-yellow-500 to-orange-500' },
];

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
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      {/* ===== PRODUCT SELECTION STEP ===== */}
      {step === 'product' && (
        <>
          {/* Hero Section */}
          <section className="relative pt-28 pb-20 overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
            
            {/* Animated glow orbs */}
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-40 right-1/4 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-4xl mx-auto animate-fade-in">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 mb-8 backdrop-blur-sm">
                  <Target className="w-5 h-5 text-red-400" />
                  <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Get Analyzed</span>
                  <Sparkles className="w-4 h-4 text-red-400" />
                </div>

                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-tight">
                  CHOOSE YOUR{" "}
                  <span className="relative">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-red-400">
                      ANALYSIS
                    </span>
                    <span className="absolute -inset-1 bg-gradient-to-r from-red-400/20 to-orange-400/20 blur-xl -z-10" />
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Upload your swing. Get your 4B Score. Know exactly what to fix.
                </p>

                {/* Trust Stats */}
                <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-12">
                  {trustStats.map((stat, i) => (
                    <div key={i} className="flex flex-col items-center group">
                      <div className={`flex items-center gap-2 text-2xl md:text-3xl font-black text-white mb-1`}>
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} bg-opacity-20`}>
                          <stat.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className={`bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                          {stat.value}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 font-medium">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Scroll indicator */}
                <div className="animate-bounce">
                  <ChevronDown className="w-8 h-8 text-slate-500 mx-auto" />
                </div>
              </div>
            </div>
          </section>

          {/* Product Selector */}
          <section className="py-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <ProductSelector onSelect={handleProductSelect} />
            </div>
          </section>

          {/* Sample Report */}
          <section className="py-16 bg-slate-900/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SampleReportPreview />
            </div>
          </section>

          {/* Trust Badges */}
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <TrustBadges />
            </div>
          </section>

          <Footer />
        </>
      )}

      {/* ===== WIZARD STEPS ===== */}
      {showStepIndicator && (
        <section className="relative pt-28 pb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <StepIndicator 
              currentStep={getStepNumber()} 
              totalSteps={3}
              onBack={handleBack}
              showBack={step !== 'product'}
            />
          </div>
        </section>
      )}

      {step === 'player' && (
        <section className="relative py-12 min-h-[60vh]">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <PlayerInfoForm 
              onSubmit={handlePlayerInfoSubmit}
              initialData={playerInfo || undefined}
            />
          </div>
        </section>
      )}

      {step === 'environment' && (
        <section className="relative py-12 min-h-[60vh]">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <EnvironmentSelector 
              onSelect={handleEnvironmentSelect}
              initialValue={environment || undefined}
              isLoading={isLoading}
            />
          </div>
        </section>
      )}

      {step === 'upload' && selectedProduct && sessionId && (
        <section className="relative py-12 min-h-[60vh]">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <VideoUploader 
              swingsRequired={selectedProduct.swingsRequired}
              swingsMaxAllowed={selectedProduct.swingsMaxAllowed}
              sessionId={sessionId}
              onComplete={handleVideosComplete}
              isCheckoutLoading={isLoading}
            />
          </div>
        </section>
      )}

      {/* ===== PROCESSING & RESULTS ===== */}
      {step === 'processing' && selectedProduct && (
        <section className="relative min-h-screen">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="relative">
            <ProcessingScreen 
              swingsCount={selectedProduct?.swingsRequired || 1}
              sessionId={sessionId}
              onComplete={handleProcessingComplete}
            />
          </div>
        </section>
      )}

      {step === 'results' && results && (
        <section className="relative min-h-screen">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="relative">
            <ResultsPage results={results} />
          </div>
        </section>
      )}

      {/* Footer for wizard steps */}
      {showStepIndicator && <Footer />}
    </div>
  );
}
