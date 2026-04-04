import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <span className="text-4xl mb-3">{icon}</span>}
      <p className="text-gray-500 mb-4">{message}</p>
      {action}
    </div>
  );
}
