import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Award, Users, Trophy, Microscope } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              MEET <span className="text-accent">RICK STRICKLAND</span>
            </h1>
            <p className="text-xl text-primary-foreground/80">
              The Swing Rehab Coach
            </p>
          </div>
        </div>
      </section>

      {/* Main Photo */}
      <section className="py-12 bg-surface">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl overflow-hidden aspect-[16/10]">
              <img 
                src={rickBenintendi} 
                alt="Rick Strickland with Andrew Benintendi" 
                className="w-full h-full object-cover object-top"
              />
            </div>
            <p className="text-center mt-4 text-muted-foreground">
              Rick with Andrew Benintendi — Gold Glove Winner, World Series Champion
            </p>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <img 
              src={rickJourneyTimeline} 
              alt="Rick Strickland's Baseball Journey - 1990s: New York Yankees Draft Pick (Professional player), 2000s: MLB Scout (New York Mets and Tampa Bay Rays), 2010s: Technology Pioneer (Helped build HitTrax, Consulted for Blast Motion & Rapsodo, Developed Reboot Motion protocols, Certified S2 Cognition facility), 2020s: MLB Hitting Coach (Baltimore Orioles AAA Norfolk Tides, 400+ college commits, 78+ professional players, 3 MLB Award Winners), Present: The Swing Rehab Coach (Catching Barrels founder, Bringing MLB technology to youth players)" 
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Bio Section */}
      <section className="py-16 bg-surface">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <p className="text-lg leading-relaxed mb-8">
              Rick Strickland is the MLB Hitting Coach for the Baltimore Orioles. 
              He's trained <span className="font-semibold text-accent">400+ college commits</span>, 
              <span className="font-semibold text-accent"> 78+ professional players</span>, and 
              <span className="font-semibold text-accent"> 3 MLB Award Winners</span>.
            </p>
          </div>
        </div>
      </section>

      {/* The Swing Rehab Coach */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Microscope className="w-8 h-8 text-accent" />
              <h2 className="text-2xl md:text-3xl font-bold">THE SWING REHAB COACH</h2>
            </div>
            
            <p className="text-lg leading-relaxed mb-8">
              Rick doesn't guess. He diagnoses swing problems like a doctor diagnoses injuries:
            </p>

            <div className="space-y-4">
              {[
                'Find the exact problem (not just "swing harder")',
                'Prescribe the exact drill (not 50 random exercises)',
                'Track your progress (with the same tech MLB teams use)',
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-4 bg-card p-4 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent font-bold">{index + 1}</span>
                  </div>
                  <span className="text-lg">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MLB-Level Technology */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <img 
              src={mlbTechnologyImg} 
              alt="MLB-Level Technology - Rick helped BUILD these systems. Now he uses them to analyze YOUR swing. Biomechanics: Reboot Motion 3D Motion Capture, Blast Motion Bat Sensors, HitTrax Ball Flight Tracking. Brain Vision: S2 Cognition MLB Evaluation System, Timing and Pattern Recognition Testing. Data Analysis: Rapsodo Pitch Tracking, Diamond Kinetics Swing Metrics, Uplift Performance Tracking." 
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-16 bg-surface">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-8 h-8 text-accent" />
              <h2 className="text-2xl md:text-3xl font-bold">CREDENTIALS</h2>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {credentials.map((cred) => (
                <div key={cred} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>{cred}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Players Trained */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-8 h-8 text-accent" />
              <h2 className="text-2xl md:text-3xl font-bold">PLAYERS RICK HAS TRAINED</h2>
            </div>

            {/* Photo gallery */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="rounded-xl overflow-hidden">
                <img 
                  src={rickCoaching2} 
                  alt="Rick coaching a player" 
                  className="w-full h-64 object-cover"
                />
              </div>
              <div className="rounded-xl overflow-hidden">
                <img 
                  src={rickSammySosa} 
                  alt="Rick with Sammy Sosa" 
                  className="w-full h-64 object-cover"
                />
                <p className="text-center mt-2 text-sm text-muted-foreground">Rick with Sammy Sosa</p>
              </div>
            </div>
            
            {/* MLB Award Winners */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-accent mb-4">MLB Award Winners:</h3>
              <div className="space-y-3">
                {mlbAwardWinners.map((player) => (
                  <div key={player.name} className="bg-card p-4 rounded-lg shadow-sm">
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-sm text-muted-foreground">{player.achievement}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other MLB Players */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Other MLB Players:</h3>
              <p className="text-muted-foreground">
                {otherMLBPlayers.join(' • ')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to train with Rick?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="hero" size="xl">
              <Link to="/analyze">GET YOUR SWING ANALYZED →</Link>
            </Button>
            <Button asChild variant="ghost" size="xl" className="text-primary-foreground hover:text-accent">
              <Link to="/inner-circle">Join the Inner Circle →</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
