/**
 * Branded SVG empty state illustrations for the 4B Player Portal.
 * Each illustration uses the brand palette (#E63946, #4ecdc4, #1a1a1a, #333).
 */

/** Swing/Upload — stylized bat with motion arcs */
export function SwingIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Motion arcs */}
      <path d="M20 60 Q40 10 60 20" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="4 3" />
      <path d="M24 58 Q42 14 58 24" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" strokeDasharray="4 3" />
      <path d="M28 56 Q44 18 56 28" stroke="#E63946" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      {/* Bat body */}
      <rect x="35" y="20" width="6" height="36" rx="3" transform="rotate(-25 38 38)" fill="#E63946" />
      <rect x="36" y="48" width="4" height="14" rx="2" transform="rotate(-25 38 55)" fill="#333" />
      {/* Impact burst */}
      <circle cx="52" cy="22" r="3" fill="#4ecdc4" opacity="0.6" />
      <circle cx="56" cy="18" r="1.5" fill="#4ecdc4" opacity="0.4" />
      <circle cx="49" cy="17" r="1" fill="#4ecdc4" opacity="0.3" />
    </svg>
  );
}

/** Chart/Trends — minimalist ascending line graph */
export function TrendsIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Grid lines */}
      <line x1="15" y1="65" x2="65" y2="65" stroke="#1a1a1a" strokeWidth="1.5" />
      <line x1="15" y1="65" x2="15" y2="15" stroke="#1a1a1a" strokeWidth="1.5" />
      {/* Trend line */}
      <polyline points="20,55 30,50 38,42 46,45 54,32 62,20" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Area fill */}
      <polygon points="20,55 30,50 38,42 46,45 54,32 62,20 62,65 20,65" fill="url(#trendGrad)" opacity="0.15" />
      {/* Dots */}
      <circle cx="20" cy="55" r="2.5" fill="#E63946" />
      <circle cx="38" cy="42" r="2.5" fill="#E63946" />
      <circle cx="62" cy="20" r="3" fill="#4ecdc4" />
      <defs>
        <linearGradient id="trendGrad" x1="40" y1="20" x2="40" y2="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E63946" />
          <stop offset="100%" stopColor="#E63946" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Messages/Chat — speech bubbles */
export function ChatIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Big bubble */}
      <rect x="12" y="18" width="38" height="24" rx="12" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
      <polygon points="24,42 20,50 32,42" fill="#1a1a1a" />
      {/* Typing dots in big bubble */}
      <circle cx="24" cy="30" r="2" fill="#555" opacity="0.6" />
      <circle cx="31" cy="30" r="2" fill="#555" opacity="0.8" />
      <circle cx="38" cy="30" r="2" fill="#555" opacity="1" />
      {/* Small reply bubble */}
      <rect x="36" y="44" width="32" height="18" rx="9" fill="#E63946" opacity="0.15" stroke="#E63946" strokeWidth="1" strokeOpacity="0.3" />
      <polygon points="58,62 62,68 52,62" fill="#E63946" opacity="0.15" />
      {/* Mini lines in reply */}
      <line x1="42" y1="51" x2="56" y2="51" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="42" y1="55" x2="50" y2="55" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** Drills/Dumbbell — stylized weights */
export function DrillsIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bar */}
      <rect x="18" y="37" width="44" height="6" rx="3" fill="#333" />
      {/* Left weight */}
      <rect x="12" y="28" width="10" height="24" rx="3" fill="#E63946" opacity="0.8" />
      <rect x="8" y="32" width="6" height="16" rx="2" fill="#E63946" />
      {/* Right weight */}
      <rect x="58" y="28" width="10" height="24" rx="3" fill="#E63946" opacity="0.8" />
      <rect x="66" y="32" width="6" height="16" rx="2" fill="#E63946" />
      {/* Sparkle accents */}
      <circle cx="40" cy="20" r="2" fill="#4ecdc4" opacity="0.5" />
      <line x1="40" y1="16" x2="40" y2="14" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="36" y1="18" x2="34" y2="16" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="44" y1="18" x2="46" y2="16" stroke="#4ecdc4" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/** Video — play button with film strip feel */
export function VideoIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Screen */}
      <rect x="14" y="18" width="52" height="36" rx="4" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
      {/* Play triangle */}
      <polygon points="34,28 34,48 52,38" fill="#E63946" opacity="0.8" />
      {/* Stand */}
      <rect x="30" y="54" width="20" height="3" rx="1.5" fill="#333" />
      <rect x="26" y="57" width="28" height="3" rx="1.5" fill="#1a1a1a" />
      {/* Scan lines for texture */}
      <line x1="18" y1="30" x2="62" y2="30" stroke="#333" strokeWidth="0.5" opacity="0.3" />
      <line x1="18" y1="38" x2="62" y2="38" stroke="#333" strokeWidth="0.5" opacity="0.3" />
      <line x1="18" y1="46" x2="62" y2="46" stroke="#333" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}

/** Scores/KRS — ring chart outline */
export function ScoresIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring */}
      <circle cx="40" cy="40" r="26" stroke="#1a1a1a" strokeWidth="5" />
      {/* Progress arc — ~60% */}
      <circle cx="40" cy="40" r="26" stroke="#E63946" strokeWidth="5" strokeLinecap="round"
        strokeDasharray="98 65" strokeDashoffset="-16"
        transform="rotate(-90 40 40)" opacity="0.8" />
      {/* Inner ring */}
      <circle cx="40" cy="40" r="18" stroke="#1a1a1a" strokeWidth="3" />
      <circle cx="40" cy="40" r="18" stroke="#4ecdc4" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="68 45" strokeDashoffset="-12"
        transform="rotate(-90 40 40)" opacity="0.5" />
      {/* Center question mark */}
      <text x="40" y="45" textAnchor="middle" fill="#555" fontSize="16" fontWeight="800" fontFamily="DM Sans, sans-serif">?</text>
    </svg>
  );
}

/** Insights/Lightbulb */
export function InsightsIllustration({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bulb outline */}
      <path d="M40 14 C28 14 20 24 20 34 C20 42 26 46 28 50 L28 54 L52 54 L52 50 C54 46 60 42 60 34 C60 24 52 14 40 14Z"
        fill="#1a1a1a" stroke="#333" strokeWidth="1.5" />
      {/* Filament glow */}
      <path d="M34 36 Q37 28 40 36 Q43 28 46 36" stroke="#E63946" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Base */}
      <rect x="30" y="54" width="20" height="4" rx="2" fill="#333" />
      <rect x="32" y="58" width="16" height="3" rx="1.5" fill="#333" opacity="0.6" />
      <rect x="34" y="61" width="12" height="3" rx="1.5" fill="#333" opacity="0.4" />
      {/* Rays */}
      <line x1="40" y1="6" x2="40" y2="10" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="14" y1="34" x2="18" y2="34" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="62" y1="34" x2="66" y2="34" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="22" y1="18" x2="25" y2="21" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <line x1="58" y1="18" x2="55" y2="21" stroke="#E63946" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}
