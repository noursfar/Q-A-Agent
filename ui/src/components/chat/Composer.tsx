import { useState, useRef, useEffect } from 'react';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function Composer({ onSend, disabled }: ComposerProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'; // max ~5 lines
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-end gap-2 max-w-3xl mx-auto px-4 py-3 rounded-2xl bg-navy-800/60 backdrop-blur-sm border border-white/5 focus-within:border-white/10 transition-colors">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask a question..."
          rows={1}
          className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/30 resize-none outline-none min-h-[24px] max-h-[160px]"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="shrink-0 w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-150"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-4 h-4 text-white disabled:text-white/30"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-white/20 mt-2">
        Wikipedia powered answers
      </p>
    </div>
  );
}
