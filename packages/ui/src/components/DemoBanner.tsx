/**
 * Persistent strip shown at the top of the app when VITE_DEMO_MODE=1 so that
 * visitors to the public GitHub Pages demo understand their changes are
 * sandboxed to their own browser tab and will be lost on refresh.
 */
export function DemoBanner() {
  if (import.meta.env.VITE_DEMO_MODE !== '1') return null;

  return (
    <div className="h-8 flex items-center justify-center bg-amber-300 text-amber-950 text-xs sm:text-sm px-4 border-b border-amber-500 font-medium">
      <span className="mr-1">Demo mode</span>
      <span className="opacity-80 hidden sm:inline">
        — changes are local to your browser session and reset on refresh.
      </span>
      <span className="opacity-80 sm:hidden">— changes reset on refresh.</span>
      <a
        href="https://github.com/yevheniidehtiar/gitpm"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 underline hover:no-underline"
      >
        Source
      </a>
    </div>
  );
}
