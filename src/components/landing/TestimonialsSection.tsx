import { Star, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef } from 'react';

const videoTestimonials = [
  { src: '/videos/testimonial-1.mp4' },
  { src: '/videos/testimonial-2.mp4' },
];

const testimonials = [
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

export function TestimonialsSection() {
  const [currentVideo, setCurrentVideo] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const goToVideo = (index: number) => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentVideo(index);
  };

  const nextVideo = () => {
    goToVideo((currentVideo + 1) % videoTestimonials.length);
  };

  const prevVideo = () => {
    goToVideo((currentVideo - 1 + videoTestimonials.length) % videoTestimonials.length);
  };

  return (
    <section className="bg-slate-900 py-24">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-red-600 text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            WHAT PLAYERS ARE SAYING
          </h2>
        </div>

        {/* Video Testimonial Carousel */}
        <div className="mb-16">
          <div className="relative max-w-3xl mx-auto">
            {/* Navigation Arrows */}
            {videoTestimonials.length > 1 && (
              <>
                <button
                  onClick={prevVideo}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-10 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-700 transition-colors hidden md:flex"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextVideo}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-10 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-700 transition-colors hidden md:flex"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Video Player */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-red-500/10">
              <video
                ref={videoRef}
                key={videoTestimonials[currentVideo].src}
                src={videoTestimonials[currentVideo].src}
                className="w-full aspect-video object-cover"
                onEnded={handleVideoEnded}
                onClick={handlePlayClick}
                playsInline
              />
              {!isPlaying && (
                <button
                  onClick={handlePlayClick}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors group"
                >
                  <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                  </div>
                </button>
              )}
            </div>

            {/* Dots Indicator */}
            {videoTestimonials.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {videoTestimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToVideo(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      index === currentVideo ? 'bg-red-500' : 'bg-slate-600 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <p className="text-center text-slate-400 mt-4 text-sm">
            Hear from players who transformed their swing with the 4B System
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-white">{testimonial.name}</h4>
                  <p className="text-sm text-slate-400">{testimonial.role}</p>
                </div>
              </div>
              
              <p className="text-slate-300 italic leading-relaxed mb-4">
                "{testimonial.quote}"
              </p>
              
              <div className="flex gap-1 text-amber-400">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4" fill="currentColor" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
