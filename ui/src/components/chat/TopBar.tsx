interface TopBarProps {
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  onToggleSidebar: () => void;
}

export default function TopBar({ status, onToggleSidebar }: TopBarProps) {
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
    <header className="flex items-center gap-4 px-5 h-[60px] bg-navy-950 shrink-0 border-b border-white/5 relative z-10">
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
      <div className="flex items-center gap-3">
        {/* Box Icon placeholder */}
        <div className="w-8 h-8 rounded bg-gradient-to-br from-[#14B8A6]/20 to-[#14B8A6]/10 flex items-center justify-center border border-[#14B8A6]/30 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-[#14B8A6]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        
        <div className="flex flex-col">
          <div className="flex items-center text-sm font-bold tracking-wide">
            <span className="text-white">TAP-</span>
            <span className="text-[#14B8A6]">Q</span>
          </div>
          <span className="text-[11px] text-white/50 leading-tight">Document Intelligence</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Status Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${status !== 'ready' && status !== 'error' ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-white/60 font-medium">{statusLabel}</span>
      </div>
    </header>
  );
}
