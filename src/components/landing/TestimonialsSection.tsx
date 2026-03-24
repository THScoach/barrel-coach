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
    name: 'Coach Mike Patterson',
    role: 'Travel Ball Coach, Texas',
    quote: "I've sent 12 of my players to Rick for analysis. Every single one improved within 2 weeks. The 4B system gives me a common language to use with my hitters.",
    avatar: 'MP',
    rating: 5,
  },
  {
    name: 'Sarah Thompson',
    role: 'Baseball Mom, Florida',
    quote: "My son was struggling at the plate. Within a week of following Rick's drill prescription, he hit his first home run. The score card made everything so clear.",
    avatar: 'ST',
    rating: 5,
  },
  {
    name: 'Jake Williams',
    role: 'High School Senior, California',
    quote: "I went from a .240 hitter to .380 in one season. The Complete Review showed me I had a bat drag problem I never knew about. Fixed it in 3 weeks.",
    avatar: 'JW',
    rating: 5,
  },
  {
    name: 'Marcus Thompson',
    role: 'D1 Commit, Texas',
    quote: "The 4B Score Card showed me exactly what was holding me back. My body score was low because of hip rotation. Fixed it, got my scholarship.",
    avatar: 'MT',
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
      <div className="relative aspect-[9/16] max-h-[480px] bg-black cursor-pointer" onClick={!playing ? handlePlay : undefined}>
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
            <div className="w-16 h-16 bg-destructive rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-bold text-white text-sm">{name}</h4>
        <p className="text-xs text-slate-500">{role}</p>
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
