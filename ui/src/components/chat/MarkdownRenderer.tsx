import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Citation } from '../../types/chat';
import CitationChip from './CitationChip';

interface MarkdownRendererProps {
  content: string;
  citations: Citation[];
  onCitationClick: (index: number) => void;
}

/**
 * Processes a text string and replaces [n] citation markers with CitationChip components.
 * Returns an array of React nodes: plain strings and CitationChip elements interleaved.
 */
function processInlineCitations(
  text: string,
  citations: Citation[],
  onCitationClick: (index: number) => void,
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const zeroIndex = num - 1; // backend uses 1-based in text
      const citation = citations[zeroIndex];
      if (citation) {
        return (
          <CitationChip
            key={i}
            index={zeroIndex}
            citation={citation}
            onClick={() => onCitationClick(zeroIndex)}
          />
        );
      }
    }
    return part;
  });
}

export default function MarkdownRenderer({
  content,
  citations,
  onCitationClick,
}: MarkdownRendererProps) {
  const components: Components = {
    // Override paragraph to process inline citation markers
    p({ children }) {
      const processChildren = (child: React.ReactNode): React.ReactNode => {
        if (typeof child === 'string') {
          return processInlineCitations(child, citations, onCitationClick);
        }
        return child;
      };

      const processed = Array.isArray(children)
        ? children.flatMap(processChildren)
        : processChildren(children);

      return <p>{processed}</p>;
    },

    // Override li to also process inline citations in list items
    li({ children }) {
      const processChildren = (child: React.ReactNode): React.ReactNode => {
        if (typeof child === 'string') {
          return processInlineCitations(child, citations, onCitationClick);
        }
        return child;
      };

      const processed = Array.isArray(children)
        ? children.flatMap(processChildren)
        : processChildren(children);

      return <li>{processed}</li>;
    },

    // Style code blocks
    code({ className, children }) {
      const isInline = !className;
      if (isInline) {
        return <code className="bg-navy-900 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300">{children}</code>;
      }
      return (
        <pre className="bg-navy-950 p-4 rounded-lg overflow-x-auto my-3">
          <code className="text-sm font-mono text-slate-300">{children}</code>
        </pre>
      );
    },

    // Style links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
        >
          {children}
        </a>
      );
    },

    // Style headings
    h1({ children }) {
      return <h1 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-base font-semibold text-white mt-3 mb-1">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-sm font-semibold text-white/90 mt-3 mb-1">{children}</h3>;
    },

    // Style blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-white/20 pl-4 text-white/60 italic my-2">
          {children}
        </blockquote>
      );
    },
  };

  return (
    <div className="prose-chat text-sm text-white/85 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
