/**
 * =============================================================================
 * LANDING PAGE MARKETING COPY — UPDATED
 * =============================================================================
 * 
 * VERSION 2.0 — Reflects full system capabilities:
 * ✅ Auto-sync with Reboot Motion (no manual uploads)
 * ✅ Automated drill prescription
 * ✅ Motor profile differentiation
 * ✅ Progress tracking over time
 * ✅ 4B Bio-Engine branding
 * 
 * STILL PROTECTED:
 * ❌ Actual formulas
 * ❌ Threshold values
 * ❌ Freeman Ratio
 * ❌ Scoring weights
 * 
 * =============================================================================
 */

export const MARKETING_COPY = {
  // ==========================================================================
  // HERO SECTION
  // ==========================================================================
  
  hero: {
    headline: "Unlock Your Swing's Hidden Potential",
    subheadline: "The 4B Bio-Engine measures capability, not just results. Find the hidden leaks in your kinetic chain — and get the drills to fix them.",
    cta: "Get My 4B Analysis",
    secondaryCta: "See How It Works",
  },
  
  // ==========================================================================
  // THE 4B BIO-ENGINE
  // ==========================================================================
  
  fourBSystem: {
    title: "The 4B Bio-Engine",
    subtitle: "Four dimensions of swing potential, measured on the professional 20-80 scout scale.",
    tagline: "Your body. Your potential. Your roadmap.",
    
    brain: {
      name: "BRAIN",
      tagline: "Pattern Consistency",
      description: "How repeatable is your movement? Elite hitters don't just have good swings — they have the same good swing, every time. Your BRAIN score measures how well your nervous system has automated the pattern.",
      whatItMeans: {
        high: "Your body knows the pattern. You're not thinking — you're reacting.",
        low: "Every swing is different. Your brain is still searching for the right movement.",
      },
      drillConnection: "Low BRAIN score? We prescribe consistency drills that build the neural pathways.",
    },
    
    body: {
      name: "BODY",
      tagline: "Energy Production",
      description: "How much energy does your lower body and core generate? Power starts from the ground. Your BODY score measures how effectively you create and transfer force through your kinetic chain.",
      whatItMeans: {
        high: "You're creating serious force from the ground up. Your legs and core are doing the heavy lifting.",
        low: "Energy is getting lost before it ever reaches your hands. There's untapped power in your foundation.",
      },
      drillConnection: "Low BODY score? We prescribe ground-force drills that unlock your lower half.",
    },
    
    bat: {
      name: "BAT",
      tagline: "Energy Delivery",
      description: "How much energy makes it to the barrel? Creating power is one thing — delivering it is another. Your BAT score measures how efficiently energy travels through your swing to where it matters.",
      whatItMeans: {
        high: "Energy flows through your swing like water through a pipe. Nothing wasted.",
        low: "Energy is leaking somewhere in the chain. You're working harder than you need to.",
      },
      drillConnection: "Low BAT score? We prescribe delivery drills that train the barrel path.",
    },
    
    ball: {
      name: "BALL",
      tagline: "Output Consistency",
      description: "How consistent is your power output? One big swing doesn't make a hitter. Your BALL score measures whether your energy delivery is repeatable, swing after swing.",
      whatItMeans: {
        high: "You deliver consistent power. Pitchers can't catch you on an off-swing.",
        low: "Your power comes and goes. Some swings feel great, others fall flat.",
      },
      drillConnection: "Low BALL score? We prescribe rhythm drills that stabilize your output.",
    },
  },
  
  // ==========================================================================
  // THE CATCH BARREL SCORE
  // ==========================================================================
  
  catchBarrelScore: {
    title: "Your Catch Barrel Score",
    description: "One number that captures your swing's total potential. Weighted across all four dimensions to give you the complete picture — and track your progress over time.",
    scale: {
      title: "The 20-80 Scout Scale",
      description: "The same scale used by Major League scouts. A 50 is average. A 70+ is elite. Where do you stand?",
      grades: [
        { range: "70-80", label: "Plus-Plus", description: "Elite potential. MLB-caliber foundation." },
        { range: "60-69", label: "Plus", description: "Above-average potential. Strong foundation to build on." },
        { range: "55-59", label: "Above Average", description: "Better than most. Room to grow." },
        { range: "45-54", label: "Average", description: "Solid foundation. Clear opportunities for improvement." },
        { range: "40-44", label: "Below Average", description: "Mechanical inefficiencies limiting potential." },
        { range: "30-39", label: "Fringe", description: "Significant leaks in the kinetic chain." },
        { range: "20-29", label: "Developmental", description: "Fundamental patterns need rebuilding." },
      ],
    },
    progressTracking: {
      title: "Watch Your Progress",
      description: "Every session is scored and tracked. See your trend lines move up as you close your leaks.",
    },
  },
  
  // ==========================================================================
  // LEAK DETECTION
  // ==========================================================================
  
  leakDetection: {
    title: "Find Your Leak",
    subtitle: "Every hitter has one. We'll find yours — and prescribe the fix.",
    description: "Energy should flow through your swing like a whip — from the ground, through your core, out to the barrel. When that chain breaks, you lose power. Our system pinpoints exactly where your energy is escaping, then assigns drills to close the gap.",
    
    leakTypes: {
      late_legs: {
        name: "Late Legs",
        simpleExplanation: "Your legs fired late — the energy showed up after your hands.",
        impact: "You're swinging with your arms instead of your whole body.",
        drillFix: "Ground Punch Drill, Wall Sit Load",
      },
      early_arms: {
        name: "Early Arms",
        simpleExplanation: "Your arms took over before your legs finished.",
        impact: "You're cutting off your power source.",
        drillFix: "Bat Behind Back Turns, Connection Ball Swings",
      },
      torso_bypass: {
        name: "Torso Bypass",
        simpleExplanation: "Energy jumped from legs to arms, skipping your core.",
        impact: "Your core isn't amplifying the energy — it's just along for the ride.",
        drillFix: "Med Ball Rotational Throws, Pause-at-Slot Swings",
      },
      no_bat_delivery: {
        name: "Lost in Translation",
        simpleExplanation: "Energy didn't make it to the barrel.",
        impact: "You're generating power but not delivering it.",
        drillFix: "Throw the Barrel, One-Arm Swings",
      },
      clean_transfer: {
        name: "Clean Transfer",
        simpleExplanation: "Energy transferred cleanly through the chain.",
        impact: "You're maximizing what your body creates.",
        drillFix: "Maintenance mode — keep doing what you're doing.",
      },
    },
    
    automatedDrills: {
      title: "Automatic Drill Prescription",
      description: "When we detect your leak, we immediately assign the right drills from Coach Rick's library. No guessing. No searching YouTube. Just the fix.",
    },
  },
  
  // ==========================================================================
  // MOTOR PROFILES (NEW)
  // ==========================================================================
  
  motorProfiles: {
    title: "Your Motor Profile",
    subtitle: "Not every hitter moves the same way — and they shouldn't train the same way.",
    description: "The 4B Bio-Engine identifies your natural movement pattern. Are you a Spinner who generates power through rotation? A Slingshotter who loads deep and explodes? Your drills are customized to YOUR motor profile.",
    
    profiles: {
      spinner: {
        name: "Spinner",
        description: "You generate power through rotational velocity. Fast hips, quick turn.",
        trainFocus: "Maximize hip speed. Train the snap.",
      },
      whipper: {
        name: "Whipper",
        description: "You create a long, elastic chain. Hands trail the body.",
        trainFocus: "Maintain separation. Let the whip crack.",
      },
      slingshotter: {
        name: "Slingshotter",
        description: "You load deep and explode. Power comes from the stretch.",
        trainFocus: "Deepen the load. Explode through contact.",
      },
      pusher: {
        name: "Pusher",
        description: "You drive through the ball with linear force.",
        trainFocus: "Stay connected. Push through the zone.",
      },
      titan: {
        name: "Titan",
        description: "Pure strength. You overpower the ball.",
        trainFocus: "Maintain efficiency. Don't leak energy.",
      },
    },
    
    whyItMatters: "A Spinner doing Slingshotter drills is wasting time. Your motor profile ensures every drill is optimized for YOUR movement pattern.",
  },
  
  // ==========================================================================
  // DIFFERENTIATION
  // ==========================================================================
  
  differentiation: {
    title: "Not Another Bat Speed App",
    points: [
      {
        theirs: "They measure bat speed.",
        ours: "We measure what your body is capable of producing.",
      },
      {
        theirs: "They track results.",
        ours: "We find the leaks preventing better results.",
      },
      {
        theirs: "They tell you what happened.",
        ours: "We tell you what's possible — and prescribe the drills to get there.",
      },
      {
        theirs: "They require manual uploads.",
        ours: "We auto-sync your sessions. Just capture and go.",
      },
    ],
    tagline: "Potential, not performance. Capability, not outcome. Coaching, not just data.",
  },
  
  // ==========================================================================
  // HOW IT WORKS (UPDATED)
  // ==========================================================================
  
  howItWorks: {
    title: "How It Works",
    subtitle: "From swing capture to personalized training — fully automated.",
    steps: [
      {
        number: 1,
        title: "Capture Your Swings",
        description: "Record sessions with Reboot Motion. Our system auto-syncs your data every 12 hours — no uploads needed.",
        icon: "📹",
      },
      {
        number: 2,
        title: "We Score the Chain",
        description: "The 4B Bio-Engine analyzes energy flow through your kinetic chain. You get Brain, Body, Bat, and Ball scores on the 20-80 scale.",
        icon: "⚙️",
      },
      {
        number: 3,
        title: "We Find Your Leak",
        description: "Our system pinpoints where energy is escaping — Late Legs, Early Arms, Torso Bypass, or Lost in Translation.",
        icon: "🔍",
      },
      {
        number: 4,
        title: "We Prescribe the Fix",
        description: "Based on your leak AND your motor profile, we assign specific drills from Coach Rick's video library.",
        icon: "🎯",
      },
      {
        number: 5,
        title: "You Train & Improve",
        description: "Do the drills. Capture more swings. Watch your scores climb. Track your progress over time.",
        icon: "📈",
      },
    ],
  },
  
  // ==========================================================================
  // AUTO-SYNC FEATURE (NEW)
  // ==========================================================================
  
  autoSync: {
    title: "Set It and Forget It",
    subtitle: "Your data syncs automatically. You just train.",
    description: "Once you're connected to Reboot Motion, the 4B Bio-Engine pulls your sessions automatically every 12 hours. No manual uploads. No waiting. Just capture your swings and check your dashboard later.",
    benefits: [
      "No file management",
      "Sessions scored within hours",
      "Drills assigned automatically",
      "Progress tracked over time",
    ],
  },
  
  // ==========================================================================
  // DRILL LIBRARY (NEW)
  // ==========================================================================
  
  drillLibrary: {
    title: "Coach Rick's Drill Vault",
    subtitle: "The exact drills used with 100+ pro players. Now assigned to you automatically.",
    description: "Every drill in the library is tagged to specific leaks and motor profiles. When the Bio-Engine detects your issue, it prescribes the right fix — complete with video instruction and coaching cues.",
    features: [
      {
        title: "Video Instruction",
        description: "Watch Coach Rick demonstrate each drill with clear, pro-level coaching.",
      },
      {
        title: "Leak-Matched",
        description: "Each drill is mapped to specific leaks. Late Legs? You get ground-force drills.",
      },
      {
        title: "Profile-Optimized",
        description: "Drills are filtered by your motor profile. A Spinner gets Spinner drills.",
      },
      {
        title: "Progress Tracked",
        description: "Mark drills complete. See what you've done and what's next.",
      },
    ],
  },
  
  // ==========================================================================
  // SOCIAL PROOF
  // ==========================================================================
  
  socialProof: {
    title: "Trusted by Pros",
    subtitle: "Coach Rick has worked with over 100 professional players.",
    notableNames: [
      "Cedric Mullins",
      "Andrew Benintendi",
      "Tommy Pham",
      "Pete Crow-Armstrong",
      "Owen Caissie",
    ],
    credibility: "4 years in the Chicago Cubs organization. Now with the Baltimore Orioles.",
    quote: {
      text: "The game is tough enough without adding unnecessary coaching pressure. Let the data guide the work.",
      author: "Coach Rick Strickland",
    },
  },
  
  // ==========================================================================
  // CTA SECTIONS (UPDATED)
  // ==========================================================================
  
  cta: {
    free: {
      title: "Get Your Free 4B Analysis",
      description: "Connect your Reboot account. We'll auto-sync your swings, score your chain, find your leak, and prescribe your first drills.",
      buttonText: "Start Free Analysis",
    },
    premium: {
      title: "Go Pro with Full Access",
      description: "Unlimited session syncing. Full drill library. Motor profile assessment. Priority support from Coach Rick's team.",
      buttonText: "Unlock Pro Access",
    },
    waitlist: {
      title: "Join the Waitlist",
      description: "We're onboarding players in waves. Get early access and be first to experience the 4B Bio-Engine.",
      buttonText: "Join Waitlist",
    },
  },
  
  // ==========================================================================
  // FAQ (UPDATED)
  // ==========================================================================
  
  faq: [
    {
      question: "What equipment do I need?",
      answer: "You need a Reboot Motion markerless motion capture setup. Once connected, your sessions auto-sync to the 4B Bio-Engine every 12 hours. Diamond Kinetics bat sensor integration is now live—connect your DK account to unlock BAT metrics.",
    },
    {
      question: "Do I have to upload files manually?",
      answer: "No. Once your Reboot account is linked, we pull your sessions automatically. Just capture your swings and check your dashboard later.",
    },
    {
      question: "How is this different from bat speed measurements?",
      answer: "Bat speed tells you the result. We measure the process — how energy flows through your body. Two hitters can have the same bat speed but completely different potentials. We find the leaks preventing you from reaching yours.",
    },
    {
      question: "What's the 20-80 scale?",
      answer: "It's the same scale MLB scouts use to grade players. 50 is average, 80 is elite. It lets you compare your potential to professional standards — and track your improvement over time.",
    },
    {
      question: "How do you find 'leaks'?",
      answer: "We analyze the timing and magnitude of energy through your kinetic chain — legs, torso, arms, bat. When energy doesn't flow in the right sequence, you lose power. We pinpoint where that's happening.",
    },
    {
      question: "What are motor profiles?",
      answer: "Your motor profile describes your natural movement pattern — Spinner, Whipper, Slingshotter, Pusher, or Titan. Each profile has different strengths, and your drills are customized to match.",
    },
    {
      question: "How do the drills work?",
      answer: "When we detect your leak, we automatically assign drills from Coach Rick's video library. Each drill is matched to your specific leak AND your motor profile. Just watch, train, and track your progress.",
    },
    {
      question: "Can this help young players?",
      answer: "Absolutely. Finding and fixing leaks early prevents bad patterns from becoming habits. The earlier you address mechanical inefficiencies, the higher your ceiling.",
    },
    {
      question: "How often are my sessions scored?",
      answer: "We sync with Reboot every 12 hours. Any new sessions are automatically scored and added to your dashboard, with new drills assigned based on your latest analysis.",
    },
  ],
};

// =============================================================================
// COMPONENT-READY EXPORTS
// =============================================================================

export const HERO = MARKETING_COPY.hero;
export const FOUR_B = MARKETING_COPY.fourBSystem;
export const CATCH_BARREL = MARKETING_COPY.catchBarrelScore;
export const LEAKS = MARKETING_COPY.leakDetection;
export const MOTOR_PROFILES = MARKETING_COPY.motorProfiles;
export const DIFF = MARKETING_COPY.differentiation;
export const HOW_IT_WORKS = MARKETING_COPY.howItWorks;
export const AUTO_SYNC = MARKETING_COPY.autoSync;
export const DRILL_LIBRARY = MARKETING_COPY.drillLibrary;
export const PROOF = MARKETING_COPY.socialProof;
export const CTA = MARKETING_COPY.cta;
export const FAQ = MARKETING_COPY.faq;
