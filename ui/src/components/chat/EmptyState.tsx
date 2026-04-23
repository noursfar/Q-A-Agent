interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  'What is retrieval-augmented generation?',
  'Explain how vector embeddings work',
  'Tell me about supervised vs unsupervised learning',
  'How does reranking improve search results?',
];

export default function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-[fadeIn_0.3s_ease-in_forwards]">
      {/* Logo / Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#14B8A6]/20 to-[#14B8A6]/10 flex items-center justify-center backdrop-blur-sm border border-[#14B8A6]/30">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-[#14B8A6]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        {/* Subtle glow behind the icon */}
        <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-[#14B8A6]/20 blur-xl -z-10" />
      </div>

      <h2 className="text-xl font-semibold text-white/90 mb-2 tracking-wide">
        <span>TAP-</span>
        <span className="text-[#14B8A6]">Q</span>
      </h2>
      <p className="text-sm text-white/40 mb-8 text-center max-w-sm">
        Ask anything about artificial intelligence (AI)
      </p>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestionClick(text)}
            className="group text-left px-4 py-3 rounded-xl bg-navy-800/60 border border-white/5 text-sm text-white/60 hover:text-white/90 hover:bg-navy-700/60 hover:border-white/10 transition-all duration-200 cursor-pointer"
          >
            <span className="text-white/30 group-hover:text-[#14B8A6] transition-colors mr-2">→</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
