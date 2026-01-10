import fourBSystemImg from '@/assets/4b-system-diagram.png';

export function FourBSystemSection() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="bg-[hsl(222,47%,11%)] rounded-t-lg py-4 max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white">
            The 4B System
          </h2>
        </div>

        {/* 4B System Infographic */}
        <div className="max-w-4xl mx-auto bg-white rounded-b-lg overflow-hidden shadow-lg">
          <img 
            src={fourBSystemImg} 
            alt="The 4B Hitting System: Brain (Timing, Sync, Pattern Recognition), Body (Ground-Up Sequencing, Force Creation), Bat (Barrel Control, Transfer Efficiency), Ball (Contact Quality, Exit Velocity)" 
            className="w-full h-auto"
          />
        </div>

        {/* Bottom Tagline */}
        <div className="max-w-3xl mx-auto mt-8 text-center">
          <p className="text-lg md:text-xl text-foreground">
            Most coaches guess. <span className="text-accent font-semibold">We measure.</span> Then we fix the weakest link.
          </p>
        </div>
      </div>
    </section>
  );
}
