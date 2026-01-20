/**
 * Marketing Copy
 * 
 * Centralized marketing text for landing page and dashboard.
 * All copy in one place for easy updates and A/B testing.
 */

// ==================== HERO SECTION ====================
export const HERO = {
  headline: "Unlock Your Kinetic DNA",
  subheadline: "The same 4B analysis system used by MLB hitting coaches—now available to serious hitters everywhere.",
  cta_primary: "Get Your Free Diagnostic",
  cta_secondary: "See How It Works",
  trust_stats: [
    { value: "2,847+", label: "Hitters Analyzed" },
    { value: "94%", label: "See Improvement" },
    { value: "60 sec", label: "Results Ready" },
  ],
} as const;

// ==================== VALUE PROPOSITIONS ====================
export const VALUE_PROPS = {
  headline: "Why the 4B System Works",
  items: [
    {
      title: "Brain",
      description: "Measure timing, intent recognition, and pitch selection patterns",
      icon: "brain",
    },
    {
      title: "Body",
      description: "Analyze kinetic sequencing from ground force to core rotation",
      icon: "activity",
    },
    {
      title: "Bat",
      description: "Track bat path, attack angle, and barrel precision",
      icon: "target",
    },
    {
      title: "Ball",
      description: "Measure exit velocity, launch angle, and hard-hit rate",
      icon: "circle",
    },
  ],
} as const;

// ==================== HOW IT WORKS ====================
export const HOW_IT_WORKS = {
  headline: "How It Works",
  subheadline: "From swing to scorecard in 60 seconds",
  steps: [
    {
      number: 1,
      title: "Upload Your Swing",
      description: "Record a swing from the side or behind. Works with any camera.",
      timing: "30 seconds",
    },
    {
      number: 2,
      title: "AI Analyzes Your Mechanics",
      description: "Our 4B engine identifies your motor profile and detects energy leaks.",
      timing: "Instant",
    },
    {
      number: 3,
      title: "Get Your Scorecard",
      description: "Receive your 20-80 grades with personalized drill recommendations.",
      timing: "60 seconds total",
    },
  ],
} as const;

// ==================== SOCIAL PROOF ====================
export const SOCIAL_PROOF = {
  headline: "Trusted by Serious Hitters",
  testimonials: [
    {
      quote: "Finally found the leak that was killing my power. Gained 4 mph exit velo in 3 weeks.",
      name: "Marcus T.",
      role: "College Junior, D1",
      avatar: null,
    },
    {
      quote: "The motor profile insight changed how I approach my training completely.",
      name: "Jake R.",
      role: "High School Senior",
      avatar: null,
    },
    {
      quote: "My son went from strikeout machine to the leadoff spot. This system works.",
      name: "David M.",
      role: "Baseball Dad",
      avatar: null,
    },
  ],
  logos: [
    { name: "Perfect Game", src: null },
    { name: "USA Baseball", src: null },
    { name: "ABCA", src: null },
  ],
} as const;

// ==================== PRICING ====================
export const PRICING = {
  headline: "Start Your Journey",
  subheadline: "Choose your path to becoming a better hitter",
  tiers: [
    {
      name: "Free Diagnostic",
      price: "0",
      period: null,
      description: "Discover your motor profile and primary leak",
      features: [
        "Motor Profile Quiz",
        "One Leak Detection",
        "SMS Coach Tips",
        "Academy Preview",
      ],
      cta: "Start Free",
      href: "/diagnostic",
      highlighted: false,
    },
    {
      name: "The Academy",
      price: "29",
      period: "month",
      description: "Full 4B analysis with personalized training",
      features: [
        "Unlimited Swing Uploads",
        "Complete 4B Scorecard",
        "Weekly Drill Programs",
        "Progress Tracking",
        "Video Breakdowns",
        "Coach Rick AI Chat",
      ],
      cta: "Join Academy",
      priceType: "academy" as const,
      highlighted: true,
    },
    {
      name: "Inner Circle",
      price: "199",
      period: "month",
      description: "1-on-1 coaching with Rick's team",
      features: [
        "Everything in Academy",
        "Weekly Video Review",
        "Direct Coach Access",
        "Custom Program Design",
        "In-Season Management",
        "Showcase Prep",
      ],
      cta: "Apply Now",
      priceType: "inner-circle" as const,
      highlighted: false,
    },
  ],
} as const;

// ==================== FAQ ====================
export const FAQ = {
  headline: "Frequently Asked Questions",
  items: [
    {
      question: "What equipment do I need?",
      answer: "Just a smartphone camera. Record from the side or behind the batter at normal speed. No special equipment required.",
    },
    {
      question: "What's a motor profile?",
      answer: "Your motor profile describes how you naturally generate power. Spinners rotate around a stable axis. Slingshotters whip from the ground up. Whippers lead with their hands. Each has different training needs.",
    },
    {
      question: "How accurate is the AI analysis?",
      answer: "Our 4B engine has been validated against MLB biomechanics data. It identifies the same patterns that pro coaches see, but in 60 seconds instead of hours of film study.",
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, both Academy and Inner Circle are month-to-month. Cancel with one click, no questions asked.",
    },
    {
      question: "What age is this for?",
      answer: "The 4B system works for hitters 12 and up. The principles are the same whether you're 14U travel ball or college.",
    },
  ],
} as const;

// ==================== CTA SECTIONS ====================
export const CTA_SECTIONS = {
  mid_page: {
    headline: "Ready to Find Your Leak?",
    subheadline: "Take the 2-minute diagnostic and discover what's holding back your swing.",
    cta: "Start Free Diagnostic",
    href: "/diagnostic",
  },
  closing: {
    headline: "Your Swing Has a Story",
    subheadline: "Let the 4B System help you write the next chapter.",
    cta: "Get Your Scorecard",
    href: "/diagnostic",
  },
} as const;

// ==================== DASHBOARD COPY ====================
export const DASHBOARD = {
  welcome: {
    headline: "Your 4B Dashboard",
    subheadline: "Track your progress and unlock your potential",
  },
  empty_state: {
    headline: "No Sessions Yet",
    subheadline: "Upload your first swing to get your 4B scorecard",
    cta: "Upload Swing",
  },
  score_labels: {
    brain: "Timing & Decision Making",
    body: "Kinetic Sequencing",
    bat: "Bat Path & Control",
    ball: "Ball Flight Quality",
    overall: "4B Composite Score",
  },
} as const;

// ==================== MOTOR PROFILES ====================
export const MOTOR_PROFILES = {
  spinner: {
    name: "Spinner",
    tagline: "Rotate to Dominate",
    description: "You generate power through core rotation around a stable axis. Like Bonds or Pujols.",
    strengths: ["Consistent contact", "Gap power", "Handles velocity"],
    focus_areas: ["Ground force activation", "Hip lead"],
  },
  slingshotter: {
    name: "Slingshotter", 
    tagline: "From the Ground Up",
    description: "You whip power from your lower half through your swing. Like Freeman or Trout.",
    strengths: ["Natural loft", "Adjustability", "Bat speed"],
    focus_areas: ["Sequence timing", "Upper body sync"],
  },
  whipper: {
    name: "Whipper",
    tagline: "Hands Lead the Way",
    description: "You lead with quick hands and generate power late in the zone. Like Ichiro or Altuve.",
    strengths: ["Bat control", "Contact ability", "Inside pitch"],
    focus_areas: ["Lower half engagement", "Power integration"],
  },
} as const;

// ==================== LEAK TYPES ====================
export const LEAK_TYPES = {
  early_extension: {
    name: "Early Extension",
    description: "Hips thrust forward too early, reducing rotational power",
    training_focus: "Ground connection drills",
  },
  casting: {
    name: "Casting",
    description: "Bat path gets long before the slot, losing bat speed",
    training_focus: "Connection ball work",
  },
  barrel_drag: {
    name: "Barrel Drag",
    description: "Bat head lags behind hands through the zone",
    training_focus: "Tee sequencing drills",
  },
  collapse: {
    name: "Back Side Collapse",
    description: "Rear leg gives out before rotation completes",
    training_focus: "Load and hold drills",
  },
  lunge: {
    name: "Forward Lunge",
    description: "Weight commits forward before pitch recognition",
    training_focus: "Rhythm and timing work",
  },
} as const;

// ==================== GRADE DESCRIPTIONS ====================
export const GRADES = {
  80: { label: "Elite", description: "Top 1% - MLB All-Star level" },
  70: { label: "Plus-Plus", description: "Top 5% - MLB starter level" },
  60: { label: "Plus", description: "Top 15% - MiLB upper level" },
  55: { label: "Above Average", description: "Top 25% - Strong college" },
  50: { label: "Average", description: "Top 40% - Solid college" },
  45: { label: "Below Average", description: "Developmental" },
  40: { label: "Fringe Average", description: "Needs significant work" },
  30: { label: "Fringe", description: "Major mechanical issues" },
  20: { label: "Poor", description: "Foundational rebuild needed" },
} as const;

// ==================== TRUST BADGES ====================
export const TRUST_BADGES = [
  "MLB Coach Analyzed",
  "60-Second Results",
  "Validated by Biomechanics",
  "2,847+ Hitters Served",
] as const;

// ==================== FOOTER ====================
export const FOOTER = {
  tagline: "Unlock your kinetic potential.",
  copyright: `© ${new Date().getFullYear()} Barrel Coach. All rights reserved.`,
  links: {
    product: [
      { label: "Free Diagnostic", href: "/diagnostic" },
      { label: "The Academy", href: "/pricing" },
      { label: "Inner Circle", href: "/inner-circle" },
    ],
    resources: [
      { label: "About Coach Rick", href: "/about" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "FAQ", href: "/#faq" },
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
} as const;
