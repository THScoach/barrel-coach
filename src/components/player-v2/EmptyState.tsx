import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
}

export function EmptyState({ icon, title, description, ctaLabel, ctaTo, onCtaClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4" style={{ color: '#555' }}>{icon}</div>
      <h3 className="text-base font-bold mb-2" style={{ color: '#fff' }}>{title}</h3>
      <p className="text-[13px] mb-6 max-w-xs" style={{ color: '#777' }}>{description}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#E63946' }}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaTo && (
        <button
          onClick={onCtaClick}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#E63946' }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
