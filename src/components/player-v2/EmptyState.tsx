import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
}

export function EmptyState({ icon, illustration, title, description, ctaLabel, ctaTo, onCtaClick }: EmptyStateProps) {
  const visual = illustration || icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-up">
      {visual && (
        <div className="mb-5" style={{ color: '#E63946' }}>
          {visual}
        </div>
      )}
      <h3 className="text-base font-black mb-2" style={{ color: '#fff' }}>{title}</h3>
      <p className="text-[13px] mb-6 max-w-xs leading-relaxed" style={{ color: '#666' }}>{description}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #E63946, #c62b38)' }}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaTo && (
        <button
          onClick={onCtaClick}
          className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #E63946, #c62b38)' }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
