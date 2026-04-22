interface TopBarProps {
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  sessionTitle: string;
  onToggleSidebar: () => void;
}

export default function TopBar({ status, sessionTitle, onToggleSidebar }: TopBarProps) {
  const statusColor =
    status === 'ready' ? 'bg-emerald-400' :
    status === 'error' ? 'bg-red-400' :
    'bg-amber-400';

  const statusLabel =
    status === 'ready' ? 'Ready' :
    status === 'error' ? 'Error' :
    status === 'submitted' ? 'Processing' :
    'Streaming';

  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-white/5 bg-navy-900/80 backdrop-blur-sm shrink-0">
      {/* Hamburger — mobile sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-4 h-4 text-white/60"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-5 h-5 text-blue-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
        <span className="text-sm font-semibold text-white/90 hidden sm:inline">Q-A Agent</span>
      </div>

      {/* Session title */}
      <div className="flex-1 text-center">
        <span className="text-sm text-white/50 truncate">{sessionTitle}</span>
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColor} ${status !== 'ready' && status !== 'error' ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-white/40 hidden sm:inline">{statusLabel}</span>
      </div>
    </header>
  );
}
