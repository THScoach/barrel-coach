import { Play, Trophy, Star, Users, Award } from 'lucide-react';
import rickBenintendi from '@/assets/rick-benintendi.jpg';

export function SocialProofSection() {
  const testimonials = [
    {
      name: 'Marcus Thompson',
      role: 'D1 Commit, Texas',
      quote: "The 4B Score Card showed me exactly what was holding me back. Fixed my bat drag in 2 weeks.",
      result: 'D1 Scholarship',
      avatar: 'MT',
    },
    {
      name: 'Jake Williams',
      role: 'Travel Ball Dad',
      quote: "My son went from batting .240 to .380 after following Rick's drill prescription. Worth every penny.",
      result: 'Travel Ball MVP',
      avatar: 'JW',
    },
  ];

  return (
    <section className="bg-white-95 py-24">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-primary text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Proven Results
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            REAL PLAYERS. REAL RESULTS.
          </h2>
        </div>

        {/* Social Proof Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Video Testimonial Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-2">
            <div className="relative aspect-video bg-navy-800 rounded-xl mb-5 overflow-hidden group cursor-pointer">
              <img 
                src={rickBenintendi} 
                alt="Rick with Andrew Benintendi" 
                className="w-full h-full object-cover"
                style={{ objectPosition: 'center 15%' }}
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-accent rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
              </div>
              <div className="absolute bottom-3 right-3 bg-black/70 px-2 py-1 rounded text-xs font-medium text-white">
                2:34
              </div>
            </div>
            <h4 className="font-bold text-navy-900 mb-1">Andrew Benintendi</h4>
            <p className="text-sm text-muted-foreground mb-3">Gold Glove Winner • World Series Champion</p>
            <p className="text-sm text-gray-600 italic">
              "Rick fixed my swing when nobody else could. His system just makes sense."
            </p>
          </div>

          {/* Metrics Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-2">
            <div className="text-6xl font-bold text-accent mb-2">78+</div>
            <p className="text-lg text-navy-900 font-medium mb-6">Professional Players Trained</p>
            
            <div className="border-t border-gray-200 pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-3xl font-bold text-navy-900">400+</div>
                  <p className="text-sm text-muted-foreground">College Commits</p>
                </div>
                <div>
                  <div className="text-3xl font-bold text-navy-900">3</div>
                  <p className="text-sm text-muted-foreground">MLB Award Winners</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-white border-2 border-white">PC</div>
                <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-white border-2 border-white">CM</div>
                <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-white border-2 border-white">DW</div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Including Pete Crow-Armstrong, Cedric Mullins, Devin Williams
              </p>
            </div>
          </div>

          {/* Before/After Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-2">
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="relative aspect-[3/4] bg-navy-800 rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <Users className="w-8 h-8 text-gray-600 mb-2" />
                  <span className="text-xs text-gray-500 text-center">Before swing photo</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-white text-xs font-bold py-2 text-center uppercase">
                  Before
                </div>
              </div>
              <div className="relative aspect-[3/4] bg-navy-800 rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <Users className="w-8 h-8 text-gray-600 mb-2" />
                  <span className="text-xs text-gray-500 text-center">After swing photo</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-success/90 text-white text-xs font-bold py-2 text-center uppercase">
                  After
                </div>
              </div>
            </div>
            
            <h4 className="font-bold text-navy-900 mb-2">{testimonials[0].name}</h4>
            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <Trophy className="w-3 h-3" />
              {testimonials[0].result}
            </div>
            <p className="text-sm text-gray-600 italic line-clamp-3">
              "{testimonials[0].quote}"
            </p>
          </div>
        </div>

        {/* Logo Banner */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <p className="text-center text-sm text-muted-foreground uppercase tracking-wider mb-8">
            Players have gone on to play for
          </p>
          <div className="flex justify-center items-center gap-12 flex-wrap opacity-50">
            <Award className="w-8 h-8 text-navy-600" />
            <Star className="w-8 h-8 text-navy-600" />
            <Trophy className="w-8 h-8 text-navy-600" />
            <Award className="w-8 h-8 text-navy-600" />
            <Star className="w-8 h-8 text-navy-600" />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-xl text-navy-900 mb-4">
            Ready to find out what's holding <em>you</em> back?
          </p>
          <a 
            href="#pricing" 
            className="inline-flex items-center justify-center px-8 py-4 bg-accent text-white font-bold text-lg rounded-lg shadow-lg hover:bg-accent/90 transition-all hover:scale-105"
          >
            Get Your Score Card
          </a>
        </div>
      </div>
    </section>
  );
}
