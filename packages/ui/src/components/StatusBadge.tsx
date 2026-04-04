const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  backlog: { bg: 'bg-status-backlog/20', text: 'text-gray-700' },
  todo: { bg: 'bg-status-todo/20', text: 'text-blue-700' },
  in_progress: { bg: 'bg-status-in_progress/20', text: 'text-amber-700' },
  in_review: { bg: 'bg-status-in_review/20', text: 'text-violet-700' },
  done: { bg: 'bg-status-done/20', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-status-cancelled/20', text: 'text-red-700' },
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.backlog;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
