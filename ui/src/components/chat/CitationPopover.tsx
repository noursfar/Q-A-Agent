import { useState, useRef, useEffect } from 'react';
import type { Citation } from '../../types/chat';

interface CitationPopoverProps {
  index: number;
  sourceTitle: string;
  citations: Citation[];
}

export default function CitationPopover({ index, sourceTitle, citations }: CitationPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Find the first matching citation for this source to show the excerpt
  const citation = citations.find((c) => c.sourceTitle.toLowerCase().includes(sourceTitle.toLowerCase()) || sourceTitle.toLowerCase().includes(c.sourceTitle.toLowerCase()));

  return (
    <span className="relative inline-block" ref={popoverRef}>
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center min-w-[1.25rem] h-[1.25rem] mx-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold hover:bg-amber-500/20 hover:scale-110 transition-all cursor-pointer border border-amber-500/20 align-text-bottom"
      >
        {index}
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 md:w-80 p-3 rounded-xl bg-navy-900 border border-white/10 shadow-xl shadow-black/50 animate-[fadeIn_0.15s_ease-out_forwards]"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Source {index}</span>
            <span className="text-sm font-semibold text-white/90 leading-tight">{sourceTitle}</span>
            {citation && (
              <div className="mt-1 border-l-2 border-white/10 pl-2">
                <p className="text-xs text-white/60 line-clamp-4 italic leading-relaxed">
                  "{citation.claim}"
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
