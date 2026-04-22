import type { UIMessage } from 'ai';
import type { Citation, CitationResult } from '../../types/chat';
import MarkdownRenderer from './MarkdownRenderer';
import CitationChip from './CitationChip';

interface MessageBubbleProps {
  message: UIMessage;
  onCitationClick: (citation: Citation, index: number) => void;
}

/**
 * Extracts citations from the message's data parts (type === 'data-citations').
 */
function extractCitations(message: UIMessage): CitationResult | null {
  for (const part of message.parts) {
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
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('');
}

export default function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const text = extractText(message);
  const citationResult = isUser ? null : extractCitations(message);
  const citations = citationResult?.citations ?? [];

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5 animate-[slideUp_0.4s_ease-out_forwards]">
        <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-blue-500 to-blue-600 text-sm text-white leading-relaxed shadow-lg shadow-blue-500/10">
          {text}
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
      <div className="max-w-[80%] flex flex-col gap-2">
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-navy-800/80 border border-white/5">
          <MarkdownRenderer
            content={text}
            citations={citations}
            onCitationClick={(idx) => {
              if (citations[idx]) onCitationClick(citations[idx], idx);
            }}
          />
        </div>

        {/* Citation chips row */}
        {citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[11px] text-white/30 mr-1">Sources:</span>
            {citations.map((c, idx) => (
              <CitationChip
                key={idx}
                index={idx}
                citation={c}
                onClick={() => onCitationClick(c, idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
