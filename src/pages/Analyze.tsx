import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { StepIndicator } from '@/components/StepIndicator';
import { ProductSelector } from '@/components/ProductSelector';
import { PlayerInfoForm } from '@/components/PlayerInfoForm';
import { EnvironmentSelector } from '@/components/EnvironmentSelector';
import { VideoUploader } from '@/components/VideoUploader';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { ResultsPage } from '@/components/ResultsPage';
import { 
  Product, 
  PlayerInfo, 
  Environment, 
  UploadedVideo,
  AnalysisResults,
  PRODUCTS 
} from '@/types/analysis';

type Step = 'product' | 'player' | 'environment' | 'upload' | 'payment' | 'processing' | 'results';

// Mock results for demo
const getMockResults = (product: Product, playerInfo: PlayerInfo): AnalysisResults => {
  const isComplete = product.id === 'complete_review';
  
  return {
    sessionId: crypto.randomUUID(),
    productType: product.id,
    playerInfo,
    compositeScore: 62,
    grade: 'Above Avg',
    scores: {
      brain: 68,
      body: 65,
      bat: 58,
      ball: 61,
    },
    mainProblem: {
      category: 'bat',
      name: 'Late Barrel Release',
      description: "You're swinging too late. Your bat reaches full speed AFTER you should hit the ball.",
      consequences: [
        "You're losing 30-50 feet of distance",
        "You'll hit weak grounders instead of line drives",
        "Pitchers will throw inside and jam you",
      ],
    },
    drill: {
      name: 'CONNECTION BALL',
      sets: 3,
      reps: 10,
      instructions: "Put a tennis ball under your front armpit. Swing without dropping it.",
      whyItWorks: "Makes you swing earlier and stay connected through the zone.",
    },
    ...(isComplete && {
      swingAnalyses: [
        { id: '1', index: 0, compositeScore: 58, scores: { brain: 60, body: 55, bat: 52, ball: 58 } },
        { id: '2', index: 1, compositeScore: 71, scores: { brain: 75, body: 70, bat: 68, ball: 72 } },
        { id: '3', index: 2, compositeScore: 65, scores: { brain: 68, body: 65, bat: 62, ball: 66 } },
        { id: '4', index: 3, compositeScore: 56, scores: { brain: 58, body: 54, bat: 50, ball: 55 } },
        { id: '5', index: 4, compositeScore: 60, scores: { brain: 62, body: 60, bat: 58, ball: 61 } },
      ],
      bestSwing: { index: 1, score: 71 },
      worstSwing: { index: 3, score: 56 },
      percentile: 62,
      thirtyDayPlan: {
        week1_2: 'Connection Ball (3×10, every day)',
        week3_4: 'Timing Tees (2×15, every day)',
        week5_6: 'Film 5 swings and upload',
        schedule: 'Monday-Friday: 10 minutes before practice | Saturday: Film 5 swings | Sunday: Rest',
      },
    }),
  };
};

export default function Analyze() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('product');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [results, setResults] = useState<AnalysisResults | null>(null);

  const getStepNumber = (): number => {
    switch (step) {
      case 'player': return 1;
      case 'environment': return 2;
      case 'upload': return 3;
      case 'payment': return 4;
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
      case 'payment':
        setStep('upload');
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

  const handleEnvironmentSelect = (env: Environment) => {
    setEnvironment(env);
    setStep('upload');
  };

  const handleVideosComplete = (uploadedVideos: UploadedVideo[]) => {
    setVideos(uploadedVideos);
    // Skip payment for demo, go straight to processing
    setStep('processing');
  };

  const handleProcessingComplete = () => {
    if (selectedProduct && playerInfo) {
      const mockResults = getMockResults(selectedProduct, playerInfo);
      setResults(mockResults);
      setStep('results');
    }
  };

  const showStepIndicator = ['player', 'environment', 'upload', 'payment'].includes(step);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {showStepIndicator && (
          <StepIndicator 
            currentStep={getStepNumber()} 
            totalSteps={4}
            onBack={handleBack}
            showBack={step !== 'product'}
          />
        )}

        <div className="mt-8">
          {step === 'product' && (
            <ProductSelector onSelect={handleProductSelect} />
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
            />
          )}

          {step === 'upload' && selectedProduct && (
            <VideoUploader 
              swingsRequired={selectedProduct.swingsRequired}
              onComplete={handleVideosComplete}
            />
          )}

          {step === 'processing' && selectedProduct && (
            <ProcessingScreen 
              swingsCount={selectedProduct.swingsRequired}
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
