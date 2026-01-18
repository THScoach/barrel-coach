export type ProductType = 'free_diagnostic' | 'academy' | 'private_coaching' | 'single_swing' | 'complete_review';

export type PlayerLevel = 
  | 'youth' 
  | 'travel' 
  | 'middle_school' 
  | 'hs_jv' 
  | 'hs_varsity' 
  | 'college' 
  | 'pro';

export type Environment = 
  | 'tee' 
  | 'soft_toss' 
  | 'front_toss' 
  | 'bp' 
  | 'machine' 
  | 'live';

export type SessionStatus = 
  | 'pending_upload' 
  | 'uploading' 
  | 'pending_payment' 
  | 'paid' 
  | 'analyzing' 
  | 'complete' 
  | 'failed';

export type UploadStatus = 'queued' | 'pending' | 'uploading' | 'uploaded' | 'error';

export interface Product {
  id: ProductType;
  name: string;
  price: number;
  swingsRequired: number;
  swingsMaxAllowed: number;
  features: string[];
  perfectFor?: string;
}

export interface PlayerInfo {
  name: string;
  age: number;
  email: string;
  phone?: string;
  level: PlayerLevel;
}

export interface UploadedVideo {
  id: string;
  index: number;
  file: File;
  previewUrl: string;
  duration: number;
  status: UploadStatus;
  storageUrl?: string;
}

export interface FourBScores {
  brain: number;
  body: number;
  bat: number;
  ball: number;
}

export interface SwingAnalysis {
  id: string;
  index: number;
  compositeScore: number;
  scores: FourBScores;
  problem?: string;
  problemDescription?: string;
}

export interface AnalysisResults {
  sessionId: string;
  productType: ProductType;
  playerInfo: PlayerInfo;
  compositeScore: number;
  grade: string;
  scores: FourBScores;
  mainProblem: {
    category: keyof FourBScores;
    name: string;
    description: string;
    consequences: string[];
  };
  drill: {
    name: string;
    sets: number;
    reps: number;
    instructions: string;
    whyItWorks: string;
  };
  // Complete Review only
  swingAnalyses?: SwingAnalysis[];
  bestSwing?: { index: number; score: number };
  worstSwing?: { index: number; score: number };
  percentile?: number;
  thirtyDayPlan?: {
    week1_2: string;
    week3_4: string;
    week5_6: string;
    schedule: string;
  };
  reportUrl?: string;
}

export interface AnalysisState {
  currentStep: 'product' | 'player' | 'environment' | 'upload' | 'payment' | 'processing' | 'results';
  selectedProduct: Product | null;
  playerInfo: PlayerInfo | null;
  environment: Environment | null;
  sessionId: string | null;
  videos: UploadedVideo[];
  uploadProgress: number;
  results: AnalysisResults | null;
  reportUrl: string | null;
}

export const PRODUCTS: Product[] = [
  {
    id: 'free_diagnostic',
    name: 'Free Diagnostic',
    price: 0,
    swingsRequired: 1,
    swingsMaxAllowed: 1,
    features: [
      'One swing snapshot',
      'Primary leak identification',
      'Direction for next steps'
    ],
    perfectFor: 'First-time analysis, quick check-in'
  },
  {
    id: 'academy',
    name: 'The Academy',
    price: 99,
    swingsRequired: 1,
    swingsMaxAllowed: 15,
    features: [
      'Unlimited swing uploads',
      'Weekly AI-guided check-ins',
      'Trend tracking & benchmarks',
      'Progress monitoring',
      'My Swing Lab access'
    ],
    perfectFor: 'Serious players training weekly, travel ball, HS varsity'
  },
  {
    id: 'private_coaching',
    name: 'Private Coaching',
    price: 199,
    swingsRequired: 1,
    swingsMaxAllowed: 15,
    features: [
      'Everything in The Academy',
      'Direct access to Coach Rick',
      '1-on-1 video feedback',
      'Priority support',
      'Personalized training plans'
    ],
    perfectFor: 'Players wanting VIP access and direct coaching'
  }
];

// Private Coaching product (used in pricing displays)
export const PRIVATE_COACHING = {
  id: 'private_coaching',
  name: 'Private Coaching',
  price: 199,
  features: [
    'Everything in The Academy',
    'Direct access to Coach Rick',
    '1-on-1 video feedback',
    'Priority support',
    'Personalized training plans'
  ],
  perfectFor: 'Players wanting VIP access and direct coaching'
};

export const LEVELS: { value: PlayerLevel; label: string }[] = [
  { value: 'youth', label: 'Youth (12U)' },
  { value: 'travel', label: 'Travel Ball' },
  { value: 'middle_school', label: 'Middle School' },
  { value: 'hs_jv', label: 'High School JV' },
  { value: 'hs_varsity', label: 'High School Varsity' },
  { value: 'college', label: 'College' },
  { value: 'pro', label: 'Pro/Independent' },
];

export const ENVIRONMENTS: { value: Environment; label: string }[] = [
  { value: 'tee', label: 'Tee' },
  { value: 'soft_toss', label: 'Soft Toss / Flips' },
  { value: 'front_toss', label: 'Front Toss' },
  { value: 'bp', label: 'Coach Pitch (BP)' },
  { value: 'machine', label: 'Machine' },
  { value: 'live', label: 'Live / Game' },
];
