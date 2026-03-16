interface TagPillProps {
  label: string;
  color: string;
}

export function TagPill({ label, color }: TagPillProps) {
  return (
    <span
      className="inline-block text-[11px] font-semibold rounded-md px-2 py-0.5"
      style={{ color, background: `${color}1f` }}
    >
      {label}
    </span>
  );
}
