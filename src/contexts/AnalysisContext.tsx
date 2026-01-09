import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  AnalysisState, 
  Product, 
  PlayerInfo, 
  Environment, 
  UploadedVideo,
  AnalysisResults 
} from '@/types/analysis';

interface AnalysisContextType extends AnalysisState {
  setProduct: (product: Product) => void;
  setPlayerInfo: (info: PlayerInfo) => void;
  setEnvironment: (env: Environment) => void;
  setSessionId: (id: string) => void;
  addVideo: (video: UploadedVideo) => void;
  updateVideo: (index: number, updates: Partial<UploadedVideo>) => void;
  removeVideo: (index: number) => void;
  setUploadProgress: (progress: number) => void;
  setResults: (results: AnalysisResults) => void;
  setStep: (step: AnalysisState['currentStep']) => void;
  reset: () => void;
}

const initialState: AnalysisState = {
  currentStep: 'product',
  selectedProduct: null,
  playerInfo: null,
  environment: null,
  sessionId: null,
  videos: [],
  uploadProgress: 0,
  results: null,
  reportUrl: null,
};

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>(initialState);

  const setProduct = (product: Product) => {
    setState(prev => ({ ...prev, selectedProduct: product }));
  };

  const setPlayerInfo = (info: PlayerInfo) => {
    setState(prev => ({ ...prev, playerInfo: info }));
  };

  const setEnvironment = (env: Environment) => {
    setState(prev => ({ ...prev, environment: env }));
  };

  const setSessionId = (id: string) => {
    setState(prev => ({ ...prev, sessionId: id }));
  };

  const addVideo = (video: UploadedVideo) => {
    setState(prev => ({
      ...prev,
      videos: [...prev.videos, video]
    }));
  };

  const updateVideo = (index: number, updates: Partial<UploadedVideo>) => {
    setState(prev => ({
      ...prev,
      videos: prev.videos.map((v, i) => 
        i === index ? { ...v, ...updates } : v
      )
    }));
  };

  const removeVideo = (index: number) => {
    setState(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index)
    }));
  };

  const setUploadProgress = (progress: number) => {
    setState(prev => ({ ...prev, uploadProgress: progress }));
  };

  const setResults = (results: AnalysisResults) => {
    setState(prev => ({ 
      ...prev, 
      results, 
      reportUrl: results.reportUrl || null 
    }));
  };

  const setStep = (step: AnalysisState['currentStep']) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const reset = () => {
    setState(initialState);
  };

  return (
    <AnalysisContext.Provider
      value={{
        ...state,
        setProduct,
        setPlayerInfo,
        setEnvironment,
        setSessionId,
        addVideo,
        updateVideo,
        removeVideo,
        setUploadProgress,
        setResults,
        setStep,
        reset,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
