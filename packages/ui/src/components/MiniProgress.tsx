export function MiniProgress({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const color =
    ratio >= 0.75
      ? 'bg-emerald-400'
      : ratio >= 0.25
        ? 'bg-yellow-400'
        : 'bg-red-400';
  return (
    <span className="inline-flex items-center gap-1 ml-auto shrink-0">
      <span className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
        <span
          className={`block h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] text-gray-500 w-7 text-right">{pct}%</span>
    </span>
  );
}
