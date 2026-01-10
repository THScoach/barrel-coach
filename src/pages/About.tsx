import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Award, Users, Trophy, Microscope, Sparkles } from 'lucide-react';
import rickBenintendi from '@/assets/rick-benintendi.jpg';
import rickCoaching2 from '@/assets/rick-coaching-2.jpg';
import rickTech from '@/assets/rick-tech.jpg';
import rickSammySosa from '@/assets/rick-sammy-sosa.jpg';
import rickJourneyTimeline from '@/assets/rick-journey-timeline.png';
import mlbTechnologyImg from '@/assets/mlb-technology.png';

const credentials = [
  'MLB Hitting Coach, Baltimore Orioles',
  'New York Yankees Draft Pick',
  'MLB Scout: New York Mets, Tampa Bay Rays',
  '30+ years in professional baseball',
];

const mlbAwardWinners = [
  { name: 'Andrew Benintendi', achievement: 'Gold Glove, World Series Champion' },
  { name: 'Jake Odorizzi', achievement: 'All-Star' },
  { name: 'Devin Williams', achievement: '2020 NL Rookie of the Year' },
];

const otherMLBPlayers = [
  'Pete Crow-Armstrong',
  'Cedric Mullins',
  'Matt Adams',
  'Carson Kelly',
  'Chad Green',
  'Matt Shaw',
  'Moisés Ballesteros',
  'Joe Boyle',
];

const techPartners = [
  'HitTrax',
  'Blast Motion',
  'Rapsodo',
  'Diamond Kinetics',
  'Reboot Motion',
];

export default function About() {
  useEffect(() => {
    document.title = 'Rick Strickland - MLB Hitting Coach, Baltimore Orioles | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative container">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">Meet the Coach</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              RICK <span className="text-red-500">STRICKLAND</span>
            </h1>
            <p className="text-xl text-slate-400">
              The Swing Rehab Coach
            </p>
          </div>
        </div>
      </section>

      {/* Main Photo */}
      <section className="py-12 bg-slate-950">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500" />
              <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-800">
                <img 
                  src={rickBenintendi} 
                  alt="Rick Strickland with Andrew Benintendi" 
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center 15%' }}
                />
              </div>
            </div>
            <p className="text-center mt-4 text-slate-400">
              Rick with Andrew Benintendi — Gold Glove Winner, World Series Champion
            </p>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <img 
              src={rickJourneyTimeline} 
              alt="Rick Strickland's Baseball Journey - 1990s: New York Yankees Draft Pick (Professional player), 2000s: MLB Scout (New York Mets and Tampa Bay Rays), 2010s: Technology Pioneer (Helped build HitTrax, Consulted for Blast Motion & Rapsodo, Developed Reboot Motion protocols, Certified S2 Cognition facility), 2020s: MLB Hitting Coach (Baltimore Orioles AAA Norfolk Tides, 400+ college commits, 78+ professional players, 3 MLB Award Winners), Present: The Swing Rehab Coach (Catching Barrels founder, Bringing MLB technology to youth players)" 
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Bio Section */}
      <section className="py-16 bg-slate-950">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <p className="text-lg leading-relaxed text-slate-300">
              Rick Strickland is the MLB Hitting Coach for the Baltimore Orioles. 
              He's trained <span className="font-semibold text-red-400">400+ college commits</span>, 
              <span className="font-semibold text-red-400"> 78+ professional players</span>, and 
              <span className="font-semibold text-red-400"> 3 MLB Award Winners</span>.
            </p>
          </div>
        </div>
      </section>

      {/* The Swing Rehab Coach */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Microscope className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">THE SWING REHAB COACH</h2>
            </div>
            
            <p className="text-lg leading-relaxed text-slate-400 mb-8">
              Rick doesn't guess. He diagnoses swing problems like a doctor diagnoses injuries:
            </p>

            <div className="space-y-4">
              {[
                'Find the exact problem (not just "swing harder")',
                'Prescribe the exact drill (not 50 random exercises)',
                'Track your progress (with the same tech MLB teams use)',
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-400 font-bold">{index + 1}</span>
                  </div>
                  <span className="text-lg text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MLB-Level Technology */}
      <section className="py-16 bg-slate-950">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <img 
              src={mlbTechnologyImg} 
              alt="MLB-Level Technology - Rick helped BUILD these systems. Now he uses them to analyze YOUR swing. Biomechanics: Reboot Motion 3D Motion Capture, Blast Motion Bat Sensors, HitTrax Ball Flight Tracking. Brain Vision: S2 Cognition MLB Evaluation System, Timing and Pattern Recognition Testing. Data Analysis: Rapsodo Pitch Tracking, Diamond Kinetics Swing Metrics, Uplift Performance Tracking." 
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trophy className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">CREDENTIALS</h2>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {credentials.map((cred) => (
                <div key={cred} className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-200">{cred}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Players Trained */}
      <section className="py-16 bg-slate-950">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Users className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">PLAYERS RICK HAS TRAINED</h2>
            </div>

            {/* Photo gallery */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-500" />
                <div className="relative rounded-xl overflow-hidden border border-slate-800">
                  <img 
                    src={rickCoaching2} 
                    alt="Rick coaching a player" 
                    className="w-full h-64 object-cover"
                  />
                </div>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-500" />
                <div className="relative rounded-xl overflow-hidden border border-slate-800">
                  <img 
                    src={rickSammySosa} 
                    alt="Rick with Sammy Sosa" 
                    className="w-full h-64 object-cover"
                  />
                </div>
                <p className="text-center mt-2 text-sm text-slate-400">Rick with Sammy Sosa</p>
              </div>
            </div>
            
            {/* MLB Award Winners */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-red-400 mb-4">MLB Award Winners:</h3>
              <div className="space-y-3">
                {mlbAwardWinners.map((player) => (
                  <div key={player.name} className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                    <div className="font-semibold text-white">{player.name}</div>
                    <div className="text-sm text-slate-400">{player.achievement}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other MLB Players */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Other MLB Players:</h3>
              <p className="text-slate-400">
                {otherMLBPlayers.join(' • ')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 via-slate-900 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent" />
        
        <div className="relative container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to train with Rick?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-6 text-lg rounded-xl">
              <Link to="/analyze">GET YOUR SWING ANALYZED →</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-lg rounded-xl">
              <Link to="/inner-circle">Join the Inner Circle →</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
