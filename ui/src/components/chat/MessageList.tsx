import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import type { Citation } from '../../types/chat';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import EmptyState from './EmptyState';

interface MessageListProps {
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  onCitationClick: (citation: Citation) => void;
  onSuggestionClick: (text: string) => void;
}

export default function MessageList({
  messages,
  status,
  onCitationClick,
  onSuggestionClick,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  if (messages.length === 0) {
    return <EmptyState onSuggestionClick={onSuggestionClick} />;
  }

  return (
    <div className="flex-1 overflow-y-auto py-4">
      <div className="max-w-3xl mx-auto space-y-2">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onCitationClick={onCitationClick}
          />
        ))}

        {(status === 'submitted' || status === 'streaming') && (
          <ThinkingIndicator status={status} />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
