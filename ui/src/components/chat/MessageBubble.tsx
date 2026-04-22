import type { UIMessage } from 'ai';
import type { Citation, CitationResult } from '../../types/chat';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  message: UIMessage;
  onCitationClick: (citation: Citation, index: number) => void;
}

/**
 * Extracts citations from the message's data parts (type === 'data-citations').
 */
function extractCitations(message: UIMessage): CitationResult | null {
  const parts = message.parts as UIMessage['parts'] | undefined;
  if (!parts) return null;
  
  for (const part of parts) {
    if (part.type === 'data-citations') {
      return part.data as CitationResult;
    }
  }
  return null;
}

/**
 * Extracts the full text content from the message's text parts.
 */
function extractText(message: UIMessage): string {
  const parts = message.parts as UIMessage['parts'] | undefined;
  if (!parts) {
    const fallback = message as unknown as { content?: string; text?: string };
    return fallback.content || fallback.text || '';
  }
  
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('');
}

export default function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const text = extractText(message);
  const citationResult = isUser ? null : extractCitations(message);
  const citations = citationResult?.citations ?? [];

  // Extract unique sources directly from the LLM's inline text
  const sourceRegex = /\[Source:\s*([^\]]+)\]/g;
  const uniqueSources = Array.from(new Set(Array.from(text.matchAll(sourceRegex)).map(m => m[1].trim())));

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3 px-4 py-1.5 animate-[slideUp_0.4s_ease-out_forwards]">
        {/* Message content */}
        <div className="max-w-[75%] px-5 py-3 rounded-2xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-sm text-white/90 leading-relaxed">
          {text}
        </div>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-white/40">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-1.5 animate-[slideUp_0.4s_ease-out_forwards]">
      {/* Bot avatar */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center shrink-0 border border-white/5 mt-0.5">
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

      {/* Message content */}
      <div className="max-w-[85%] flex flex-col gap-0.5">
        <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-[#1A2033] border border-white/5 shadow-sm text-[14px]">
          <MarkdownRenderer 
            content={text} 
            citations={citations} 
            uniqueSources={uniqueSources}
            onCitationClick={onCitationClick}
          />
        </div>

        {/* Bottom Sources Bar */}
        {uniqueSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-2 py-2">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mr-1">Sources</span>
            {uniqueSources.map((sourceTitle, i) => {
              const index = i + 1;
              const matchingCitation = citations.find(c => c.sourceTitle.toLowerCase().includes(sourceTitle.toLowerCase()) || sourceTitle.toLowerCase().includes(c.sourceTitle.toLowerCase()));
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (matchingCitation) onCitationClick(matchingCitation, index - 1);
                  }}
                  className="group flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                >
                  <span className="text-[11px] font-bold text-amber-500">[{index}]</span>
                  <span className="text-xs text-white/60 group-hover:text-white/90 transition-colors">{sourceTitle}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
