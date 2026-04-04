const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'text-red-600 bg-red-50' },
  high: { label: 'High', className: 'text-orange-600 bg-orange-50' },
  medium: { label: 'Medium', className: 'text-yellow-600 bg-yellow-50' },
  low: { label: 'Low', className: 'text-gray-500 bg-gray-50' },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
