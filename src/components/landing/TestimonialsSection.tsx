import { Star, Play } from 'lucide-react';
import { useState, useRef } from 'react';

const videoTestimonials = [
  {
    name: 'Eric W.',
    role: 'Player Testimonial',
    videoSrc: '/videos/testimonial-eric-w.mp4',
  },
  {
    name: 'Kendall B.',
    role: 'Player Testimonial',
    videoSrc: '/videos/testimonial-kendall-b.mp4',
  },
];

const writtenTestimonials = [
  {
    name: 'Andrew Benintendi',
    role: 'OF – Boston Red Sox',
    quote: "I heard a lot of good things about Rick and his program and it has lived up to the hype. I have been able to learn a lot about my swing and really narrow down what areas I need to work on through the technology and expertise of Rick.",
    avatar: 'AB',
    rating: 5,
  },
  {
    name: 'Jake Odorizzi',
    role: 'SP – Minnesota Twins',
    quote: "Coach Strickland was instrumental in preparing me for baseball at the next level. I would certainly recommend that any player with aspirations of playing collegiate or professional baseball turn to him and his staff for the same guidance and instruction they provided me — it is a partnership I could not have done without.",
    avatar: 'JO',
    rating: 5,
  },
  {
    name: 'Cody Asche',
    role: '3B – New York Mets',
    quote: "I would tell anyone with aspirations to play baseball at the next level that a partnership with Rick and his advanced hitting program is a must!",
    avatar: 'CA',
    rating: 5,
  },
  {
    name: 'Matt Adams',
    role: '1B/OF – Washington Nationals',
    quote: "Working with Rick and his staff has been amazing. The program is broken down into steps that will guide you through the process of developing an elite swing. When you combine that with his knowledge of how to apply technology this program is a must for any aspiring player.",
    avatar: 'MA',
    rating: 5,
  },
  {
    name: 'Rafael Lopez',
    role: 'C – San Diego Padres',
    quote: "From the time I started with Rick every aspect of my swing has improved...plate coverage, power, consistency. I have never been around baseball technology before, and honestly thought it was kind of stupid, until I learned how to use it and it has been a tremendous asset.",
    avatar: 'RL',
    rating: 5,
  },
  {
    name: 'Bill Volz',
    role: 'Parent',
    quote: "I will probably never be able to fully express the gratitude and appreciation I have for what you have done for my son. The immense positive impact you, your trainers, and your whole organization have had on my son's life is truly unexplainable. You truly are the definition of a mentor.",
    avatar: 'BV',
    rating: 5,
  },
];

function VideoCard({ name, role, videoSrc }: { name: string; role: string; videoSrc: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      <div className="relative aspect-[9/16] max-h-[360px] sm:max-h-[480px] bg-black cursor-pointer" onClick={!playing ? handlePlay : undefined}>
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          controls={playing}
          playsInline
          preload="metadata"
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-destructive rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              <Play className="w-5 h-5 sm:w-7 sm:h-7 text-white ml-0.5 sm:ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h4 className="font-bold text-white text-xs sm:text-sm">{name}</h4>
        <p className="text-[10px] sm:text-xs text-slate-500">{role}</p>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-slate-900/60">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
          What Players Are{" "}
          <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
            Saying
          </span>
        </h2>
        <p className="text-slate-400 text-center mb-12">
          Real results from hitters who trained with the 4B System
        </p>

        {/* Video Testimonials */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
          {videoTestimonials.map((v, i) => (
            <VideoCard key={i} {...v} />
          ))}
        </div>

        {/* Written Testimonials */}
        <div className="grid md:grid-cols-2 gap-6">
          {writtenTestimonials.map((t, i) => (
            <div
              key={i}
              className="bg-slate-950 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-destructive/15 border border-destructive/20 flex items-center justify-center text-sm font-bold text-destructive">
                  {t.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.name}</h4>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>

              <p className="text-slate-300 text-sm italic leading-relaxed mb-4">
                "{t.quote}"
              </p>

              <div className="flex gap-0.5 text-amber-400">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5" fill="currentColor" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
