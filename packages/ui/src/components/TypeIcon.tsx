const TYPE_ICONS: Record<string, string> = {
  story: '📋',
  epic: '🎯',
  milestone: '🏁',
  roadmap: '🗺️',
  prd: '📄',
};

export function TypeIcon({
  type,
  className,
}: { type: string; className?: string }) {
  return <span className={className}>{TYPE_ICONS[type] ?? '📎'}</span>;
}
