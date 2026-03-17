// Player portal shared utilities

/**
 * Consistent score color system for 4B pillars:
 * 85–100: #22C55E (green — elite)
 * 70–84:  #00B4D8 (electric blue — good)
 * 50–69:  #FFA000 (amber — developing)
 * 0–49:   #FF3B30 (red — needs work)
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#6B7A8F';
  if (score >= 85) return '#22C55E';
  if (score >= 70) return '#00B4D8';
  if (score >= 50) return '#FFA000';
  return '#FF3B30';
}

export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 85) return 'ELITE';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'DEVELOPING';
  return 'NEEDS WORK';
}

export function motorProfileColor(profile: string | null | undefined): string {
  const p = (profile || '').toLowerCase();
  if (p.includes('spinner')) return '#4488ff';
  if (p.includes('whipper')) return '#44ff88';
  if (p.includes('slingshot')) return '#ff8844';
  return '#a0a0a0';
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function bandForWeight(lbs: number | null | undefined): { label: string; color: string } {
  if (!lbs) return { label: 'Red', color: '#FF3B30' };
  if (lbs < 160) return { label: 'Red', color: '#FF3B30' };
  if (lbs <= 250) return { label: 'Black', color: '#ffffff' };
  return { label: 'Double Black', color: '#ffffff' };
}
