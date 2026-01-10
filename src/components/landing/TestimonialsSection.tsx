import { Star } from 'lucide-react';

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
  return (
    <section className="bg-white-95 py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-primary text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-navy-900">
            WHAT PLAYERS ARE SAYING
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-navy-700 flex items-center justify-center text-lg font-bold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-navy-900">{testimonial.name}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
              
              <p className="text-gray-600 italic leading-relaxed mb-4">
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
