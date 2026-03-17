import { Link } from "react-router-dom";
import { Upload } from "lucide-react";

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
      <div className="mb-4" style={{ color: '#FF3B30' }}>{icon}</div>
      <h3 className="text-base font-bold mb-2" style={{ color: '#fff' }}>{title}</h3>
      <p className="text-[13px] mb-6 max-w-xs" style={{ color: '#B0B8C8' }}>{description}</p>
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#FF3B30' }}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaTo && (
        <button
          onClick={onCtaClick}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: '#FF3B30' }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
