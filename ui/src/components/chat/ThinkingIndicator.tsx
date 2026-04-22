interface ThinkingIndicatorProps {
  status: 'submitted' | 'streaming';
}

export default function ThinkingIndicator({ status }: ThinkingIndicatorProps) {
  const label = status === 'submitted' ? 'Thinking...' : 'Generating...';

  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-[fadeIn_0.3s_ease-in_forwards]">
      {/* Bot avatar */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center shrink-0 border border-white/5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-4 h-4 text-blue-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
      </div>

      {/* Thinking bubble */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-navy-800/80 border border-white/5">
        {/* Bouncing dots */}
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounceDot_1.4s_infinite_ease-in-out_both]" style={{ animationDelay: '0s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounceDot_1.4s_infinite_ease-in-out_both]" style={{ animationDelay: '0.16s' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounceDot_1.4s_infinite_ease-in-out_both]" style={{ animationDelay: '0.32s' }} />
        </div>
        <span className="text-xs text-white/40 ml-1">{label}</span>
      </div>
    </div>
  );
}
