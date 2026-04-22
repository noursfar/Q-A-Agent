import type { Citation } from '../../types/chat';

interface SourcesPanelProps {
  citation: Citation | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function SourcesPanel({ citation, isOpen, onClose }: SourcesPanelProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none z-40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed lg:absolute top-0 right-0 h-full w-full sm:w-[380px] z-50
          bg-navy-900/95 backdrop-blur-xl border-l border-white/5
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white/90">Source Details</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-4 h-4 text-white/50"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {citation ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Source title */}
            <div>
              <label className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Document
              </label>
              <p className="text-sm text-white/90 mt-1 font-medium">{citation.sourceTitle}</p>
            </div>

            {/* Chunk index */}
            <div>
              <label className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Chunk Index
              </label>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs font-semibold text-amber-400">#{citation.chunkIndex}</span>
              </div>
            </div>

            {/* Claim */}
            <div>
              <label className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Cited Claim
              </label>
              <blockquote className="mt-2 border-l-2 border-amber-500/40 pl-4 text-sm text-white/70 italic leading-relaxed">
                "{citation.claim}"
              </blockquote>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-white/30">Click a citation to view details</p>
          </div>
        )}
      </div>
    </>
  );
}
