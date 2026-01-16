import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { 
  Video, 
  Bluetooth, 
  Upload, 
  CheckCircle2, 
  Lock,
  ArrowRight
} from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'available' | 'locked';
  statusText: string;
  description: string;
  powersScores: string[];
  buttonText: string;
  metrics?: string[];
  badge?: string;
  membershipOnly?: boolean;
}

const dataSources: DataSource[] = [
  {
    id: 'video',
    name: 'VIDEO ANALYSIS',
    icon: '📹',
    status: 'connected',
    statusText: 'Connected',
    description: 'Powers your BODY and BRAIN scores',
    powersScores: ['BODY', 'BRAIN'],
    buttonText: 'Upload Video',
    membershipOnly: false,
  },
  {
    id: 'diamond-kinetics',
    name: 'DIAMOND KINETICS',
    icon: '🦇',
    status: 'available',
    statusText: 'Connect DK Account',
    description: 'Powers your BAT score with real sensor data',
    powersScores: ['BAT'],
    buttonText: 'Connect Diamond Kinetics',
    metrics: ['Bat Speed', 'Attack Angle', 'Hand Speed'],
    membershipOnly: true,
  },
  {
    id: 'batted-ball',
    name: 'BATTED BALL DATA',
    icon: '⚾',
    status: 'available',
    statusText: 'Upload Data',
    description: 'Powers your BALL score with real outcomes',
    powersScores: ['BALL'],
    buttonText: 'Upload Batted Ball Data',
    metrics: ['Exit Velo', 'Launch Angle', 'Distance'],
    membershipOnly: true,
  },
  {
    id: 'reboot',
    name: 'REBOOT MOTION',
    icon: '🎯',
    status: 'available',
    statusText: 'Upload 3D Capture',
    description: 'Upgrades BODY and BRAIN to precise 3D measurement',
    powersScores: ['BODY', 'BRAIN'],
    buttonText: 'Upload Reboot File',
    badge: 'PRO',
    membershipOnly: true,
  },
];

const dataCoverage = [
  { score: 'BODY', percentage: 75, source: 'video', color: 'bg-blue-500' },
  { score: 'BRAIN', percentage: 75, source: 'video', color: 'bg-purple-500' },
  { score: 'BAT', percentage: 0, source: 'no DK connected', color: 'bg-orange-500' },
  { score: 'BALL', percentage: 0, source: 'no batted ball data', color: 'bg-green-500' },
];

export default function MyData() {
  const [isMember] = useState(true); // TODO: Get from auth context

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              MY DATA SOURCES
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              The more data you connect, the stronger your 4B Score becomes.
            </p>
          </div>

          {/* Data Source Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {dataSources.map((source) => (
              <DataSourceCard 
                key={source.id} 
                source={source} 
                isMember={isMember} 
              />
            ))}
          </div>

          {/* 4B Data Coverage Section */}
          <Card className="bg-slate-900/50 border-slate-800 p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              YOUR 4B DATA COVERAGE
            </h2>
            
            <div className="space-y-6 max-w-2xl mx-auto">
              {dataCoverage.map((item) => (
                <div key={item.score} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{item.score}</span>
                    <span className="text-sm text-slate-400">
                      {item.percentage}% ({item.source})
                    </span>
                  </div>
                  <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-slate-400 flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4 text-orange-400" />
                <span>
                  <span className="text-orange-400 font-semibold">Connect Diamond Kinetics</span>
                  {' '}to complete your BAT score
                </span>
              </p>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

interface DataSourceCardProps {
  source: DataSource;
  isMember: boolean;
}

function DataSourceCard({ source, isMember }: DataSourceCardProps) {
  const isLocked = source.membershipOnly && !isMember;
  const isConnected = source.status === 'connected';

  return (
    <Card className={`relative bg-slate-900/50 border-slate-800 p-6 transition-all hover:border-slate-700 ${
      isLocked ? 'opacity-60' : ''
    }`}>
      {/* PRO Badge */}
      {source.badge && (
        <Badge className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold">
          {source.badge}
        </Badge>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">{source.icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{source.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {isConnected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500 font-medium">
                  {source.statusText}
                </span>
              </>
            ) : isLocked ? (
              <>
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500">Membership Only</span>
              </>
            ) : (
              <span className="text-sm text-slate-400">{source.statusText}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-400 text-sm mb-4">{source.description}</p>

      {/* Metrics Preview (when connected) */}
      {source.metrics && isConnected && (
        <div className="flex flex-wrap gap-2 mb-4">
          {source.metrics.map((metric) => (
            <Badge key={metric} variant="secondary" className="bg-slate-800 text-slate-300">
              {metric}
            </Badge>
          ))}
        </div>
      )}

      {/* Accepts (for batted ball) */}
      {source.id === 'batted-ball' && !isConnected && (
        <p className="text-xs text-slate-500 mb-4">
          Accepts: Hittrax, Rapsodo, Trackman CSV exports
        </p>
      )}

      {/* Action Button */}
      <Button 
        className={`w-full ${
          isConnected 
            ? 'bg-green-600 hover:bg-green-700' 
            : isLocked 
              ? 'bg-slate-700 cursor-not-allowed' 
              : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
        }`}
        disabled={isLocked}
      >
        {isLocked ? (
          <>
            <Lock className="w-4 h-4 mr-2" />
            Upgrade to Membership
          </>
        ) : isConnected ? (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload More
          </>
        ) : (
          source.buttonText
        )}
      </Button>
    </Card>
  );
}
