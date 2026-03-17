// Player portal shared utilities — 4B brand system

/**
 * Score color system:
 * 80+:  #4ecdc4 (teal — elite)
 * 60–79: #ffa500 (orange — working)
 * <60:  #E63946 (red — priority)
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#555555';
  if (score >= 80) return '#4ecdc4';
  if (score >= 60) return '#ffa500';
  return '#E63946';
}

export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 90) return 'ELITE';
  if (score >= 80) return 'GOOD';
  if (score >= 60) return 'WORKING';
  return 'PRIORITY';
}

export function motorProfileColor(profile: string | null | undefined): string {
  const p = (profile || '').toLowerCase();
  if (p.includes('spinner')) return '#4488ff';
  if (p.includes('whipper')) return '#44ff88';
  if (p.includes('slingshot')) return '#ff8844';
  if (p.includes('titan')) return '#cc44ff';
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
  if (!lbs) return { label: 'Red', color: '#E63946' };
  if (lbs < 160) return { label: 'Red', color: '#E63946' };
  if (lbs <= 250) return { label: 'Black', color: '#ffffff' };
  return { label: 'Double Black', color: '#ffffff' };
}
