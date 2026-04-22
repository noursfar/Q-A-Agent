import type { Citation } from '../../types/chat';

interface CitationChipProps {
  index: number;
  citation: Citation;
  onClick: () => void;
}

export default function CitationChip({ index, citation, onClick }: CitationChipProps) {
  return (
    <button
      onClick={onClick}
      title={`${citation.sourceTitle} — "${citation.claim}"`}
      className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold hover:bg-amber-500/25 hover:scale-110 transition-all duration-150 cursor-pointer border border-amber-500/20"
    >
      {index + 1}
    </button>
  );
}
