import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Award, Users, Trophy, Microscope, Sparkles, Quote } from 'lucide-react';
import rickBenintendi from '@/assets/rick-benintendi.jpg';
import rickCoaching2 from '@/assets/rick-coaching-2.jpg';
import rickTech from '@/assets/rick-tech.jpg';
import rickSammySosa from '@/assets/rick-sammy-sosa.jpg';

const timelineEvents = [
  {
    team: 'New York Yankees',
    role: 'Draft Pick & Minor League Player',
    period: '1990s',
    description: 'Started the journey as a professional player in the Yankees organization.',
  },
  {
    team: 'Texas Rangers, New York Mets, Tampa Bay Rays',
    role: 'MLB Scout & Consultant',
    period: '2000s–2010s',
    description: 'Viewed the swing through every professional lens—scouting, player development, and organizational strategy.',
  },
  {
    team: 'Chicago Cubs',
    role: 'Hitting Coach, AA Knoxville → AAA Iowa',
    period: '2022–2025',
    description: 'Refined the 4B Bio-Engine in the cages of one of MLB\'s most data-forward organizations.',
  },
  {
    team: 'Baltimore Orioles',
    role: 'AAA Hitting Coach',
    period: '2026–Present',
    description: 'Currently at the forefront of the biomechanical revolution with the Orioles.',
  },
];

const statsData = [
  { value: '30+', label: 'Years of Professional Experience' },
  { value: '100+', label: 'Pro Players Developed' },
  { value: '400+', label: 'College Commits' },
  { value: '78+', label: 'Professional Alumni' },
];

const proPlayersWorkedWith = [
  'Cedric Mullins',
  'Andrew Benintendi',
  'Tommy Pham',
  'Pete Crow-Armstrong',
  'Matt Adams',
  'Carson Kelly',
  'Chad Green',
  'Matt Shaw',
  'Moisés Ballesteros',
  'Joe Boyle',
  'Jake Odorizzi',
  'Devin Williams',
];

export default function About() {
  useEffect(() => {
    document.title = 'Rick Strickland | The Architect of Human 3.0 | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Deep black background with red radial glow */}
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DC2626]/30 via-black to-black" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative container">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/30 mb-6">
              <Sparkles className="w-4 h-4 text-[#DC2626]" />
              <span className="text-sm font-semibold text-[#DC2626] uppercase tracking-wider">The Architect</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
              RICK <span className="text-[#DC2626]">STRICKLAND</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-light">
              The Architect of <span className="text-[#DC2626] font-semibold">Human 3.0</span>
            </p>
          </div>
        </div>
      </section>

      {/* Main Photo with Red Radial Glow */}
      <section className="py-12 bg-black">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="relative group">
              {/* Red radial glow behind image */}
              <div className="absolute -inset-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DC2626]/40 via-[#DC2626]/10 to-transparent rounded-full blur-3xl opacity-60" />
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

      {/* The Pedigree Section */}
      <section className="py-16 bg-black border-y border-slate-800/50">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
              THE <span className="text-[#DC2626]">PEDIGREE</span>
            </h2>
            
            <p className="text-lg md:text-xl leading-relaxed text-slate-300 text-center">
              Rick Strickland doesn't just coach swings; he <span className="font-semibold text-white">builds athletes</span>. 
              A former minor league player with the <span className="text-[#DC2626] font-semibold">New York Yankees</span>, 
              Rick has spent three decades in the trenches of professional baseball, developing the most advanced 
              hitting methodology in the game today.
            </p>
            
            <p className="text-lg md:text-xl leading-relaxed text-slate-300 text-center mt-6">
              From scouting for the <span className="text-[#DC2626] font-semibold">Texas Rangers</span> to consulting 
              for the <span className="text-[#DC2626] font-semibold">St. Louis Cardinals</span>, and scouting with 
              the <span className="text-[#DC2626] font-semibold">New York Mets</span> and <span className="text-[#DC2626] font-semibold">Tampa Bay Rays</span>, 
              Rick has viewed the swing through every professional lens possible.
            </p>
          </div>
        </div>
      </section>

      {/* The Laboratory Years - Vertical Timeline */}
      <section className="py-16 bg-slate-950/50">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-center">
              THE <span className="text-[#DC2626]">LABORATORY</span> YEARS
            </h2>
            <p className="text-center text-slate-400 mb-12">
              Chicago to Baltimore
            </p>
            
            <p className="text-lg text-slate-300 text-center mb-12">
              The 4B Bio-Engine wasn't built in a vacuum. It was refined in the cages of the most 
              data-forward organizations in Major League Baseball.
            </p>

            {/* Vertical Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#DC2626] via-[#DC2626]/50 to-slate-700 md:-translate-x-0.5" />
              
              {timelineEvents.map((event, index) => (
                <div 
                  key={index} 
                  className={`relative flex items-start mb-12 last:mb-0 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  {/* Timeline dot */}
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-[#DC2626] rounded-full border-4 border-black -translate-x-1/2 z-10" />
                  
                  {/* Content */}
                  <div className={`ml-12 md:ml-0 md:w-[calc(50%-2rem)] ${
                    index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8 md:text-left'
                  }`}>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
                      <span className="inline-block px-3 py-1 bg-[#DC2626]/20 text-[#DC2626] text-sm font-bold rounded-full mb-3">
                        {event.period}
                      </span>
                      <h3 className="text-xl font-bold text-[#DC2626] mb-1">
                        {event.team}
                      </h3>
                      <p className="text-white font-semibold mb-2">{event.role}</p>
                      <p className="text-slate-400 text-sm">{event.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-lg text-slate-300 text-center mt-12">
              During his tenure with the Cubs and his current role with the Orioles, Rick has been at the 
              forefront of the biomechanical revolution. He has worked with over <span className="text-[#DC2626] font-bold">100 professional players</span>, 
              including stars like <span className="text-white font-semibold">Cedric Mullins</span>, <span className="text-white font-semibold">Andrew Benintendi</span>, 
              and <span className="text-white font-semibold">Tommy Pham</span>, helping them navigate the gap between raw intent and elite kinetic efficiency.
            </p>
          </div>
        </div>
      </section>

      {/* The Methodology - Large Bold Quote */}
      <section className="py-20 bg-black border-y border-slate-800/50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
              THE <span className="text-[#DC2626]">METHODOLOGY</span>
              <span className="block text-lg font-normal text-slate-400 mt-2">Potential, Not Performance</span>
            </h2>
            
            {/* Large Quote Block */}
            <div className="relative bg-slate-900/50 border border-slate-800 rounded-2xl p-8 md:p-12 mb-12">
              <Quote className="absolute top-4 left-4 w-12 h-12 text-[#DC2626]/30" />
              <blockquote className="text-2xl md:text-3xl lg:text-4xl font-bold text-white text-center leading-tight relative z-10">
                "The game is tough enough without adding unnecessary coaching pressure. 
                <span className="text-[#DC2626]"> My job is to let the data guide the work.</span>"
              </blockquote>
              <Quote className="absolute bottom-4 right-4 w-12 h-12 text-[#DC2626]/30 rotate-180" />
            </div>
            
            <div className="text-center space-y-6">
              <p className="text-lg md:text-xl text-slate-300">
                Rick's philosophy is simple: <span className="font-bold text-white">Capability over Outcome</span>.
              </p>
              <p className="text-lg text-slate-400">
                By utilizing the 4B Bio-Engine, Rick identifies the "<span className="text-[#DC2626] font-semibold">Kinetic Fingerprint</span>" 
                of every hitter. Whether you are a <span className="text-white">Spinner</span>, <span className="text-white">Whipper</span>, 
                or <span className="text-white">Slingshotter</span>, Rick's system finds the hidden energy leaks in your chain and 
                prescribes the exact biomechanical fix needed to reach your ceiling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Stats */}
      <section className="py-16 bg-slate-950/50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
              THE <span className="text-[#DC2626]">STATS</span>
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {statsData.map((stat, index) => (
                <div 
                  key={index} 
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 text-center"
                >
                  <div className="text-4xl md:text-5xl font-black text-[#DC2626] mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-300 font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pro Players Gallery */}
      <section className="py-16 bg-black border-y border-slate-800/50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 justify-center mb-8">
              <div className="p-2 bg-[#DC2626]/20 rounded-lg">
                <Users className="w-6 h-6 text-[#DC2626]" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">PRO ALUMNI</h2>
            </div>

            {/* Photo gallery */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div className="relative group">
                <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DC2626]/20 via-transparent to-transparent rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500" />
                <div className="relative rounded-xl overflow-hidden border border-slate-800">
                  <img 
                    src={rickCoaching2} 
                    alt="Rick coaching a player" 
                    className="w-full h-64 object-cover"
                  />
                </div>
              </div>
              <div className="relative group">
                <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DC2626]/20 via-transparent to-transparent rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500" />
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
            
            {/* Players List */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-[#DC2626] mb-4">Players Rick Has Worked With:</h3>
              <p className="text-slate-300 text-lg">
                {proPlayersWorkedWith.map((player, i) => (
                  <span key={player}>
                    <span className="font-medium text-white">{player}</span>
                    {i < proPlayersWorkedWith.length - 1 && <span className="text-slate-600"> • </span>}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DC2626]/30 via-black to-black" />
        
        <div className="relative container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to train with <span className="text-[#DC2626]">The Architect</span>?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-bold px-8 py-6 text-lg rounded-xl">
              <Link to="/diagnostic">GET YOUR FREE DIAGNOSTIC →</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-600 text-white hover:bg-slate-800 px-8 py-6 text-lg rounded-xl">
              <Link to="/pricing">View Pricing →</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
