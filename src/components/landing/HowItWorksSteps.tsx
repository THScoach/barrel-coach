import { Upload, Search, FileCheck, Video } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Upload Your Swing',
    description: 'Record from the side, 10-15 feet away. One swing, 5 seconds.',
    icon: Upload,
  },
  {
    number: 2,
    title: 'AI + Coach Analysis',
    description: 'Our system scans your mechanics. Rick reviews the findings.',
    icon: Search,
  },
  {
    number: 3,
    title: 'Get Your 4B Score',
    description: 'See your Brain, Body, Bat, Ball scores. Know your weakest link.',
    icon: FileCheck,
  },
  {
    number: 4,
    title: 'Watch Your Drill',
    description: 'Get a personalized drill video to fix your #1 problem.',
    icon: Video,
  },
];

export function HowItWorksSteps() {
  return (
    <section className="bg-white py-24">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-primary text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-navy-900">
            GET YOUR SCORE IN 60 SECONDS
          </h2>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="text-center">
                <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-3 uppercase">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
