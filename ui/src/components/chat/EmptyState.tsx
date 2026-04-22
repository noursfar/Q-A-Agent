interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  'What is retrieval-augmented generation?',
  'Explain how vector embeddings work',
  'What are the benefits of chunking documents?',
  'How does reranking improve search results?',
];

export default function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-[fadeIn_0.3s_ease-in_forwards]">
      {/* Logo / Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-amber-500/20 flex items-center justify-center backdrop-blur-sm border border-white/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-10 h-10 text-blue-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
            />
          </svg>
        </div>
        {/* Subtle glow behind the icon */}
        <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-blue-500/10 blur-xl -z-10" />
      </div>

      <h2 className="text-xl font-semibold text-white/90 mb-2">Q-A Agent</h2>
      <p className="text-sm text-white/40 mb-8 text-center max-w-sm">
        Ask anything about your documents. Answers are grounded in your uploaded sources with inline citations.
      </p>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => onSuggestionClick(text)}
            className="group text-left px-4 py-3 rounded-xl bg-navy-800/60 border border-white/5 text-sm text-white/60 hover:text-white/90 hover:bg-navy-700/60 hover:border-white/10 transition-all duration-200 cursor-pointer"
          >
            <span className="text-white/30 group-hover:text-amber-400 transition-colors mr-2">→</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
