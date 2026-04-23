import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Citation } from '../../types/chat';
import CitationPopover from './CitationPopover';
import { SPLIT_CITATION_REGEX, EXACT_CITATION_REGEX } from '../../utils/text';
interface MarkdownRendererProps {
  content: string;
  citations: Citation[];
  uniqueSources: string[];
  onCitationClick: (citation: Citation, index: number) => void;
}

function processInlineSources(
  text: string,
  uniqueSources: string[],
  citations: Citation[],
  onCitationClick: (citation: Citation, index: number) => void,
): React.ReactNode[] {
  // Split the text by [Source: Title] or [Source: Title ] etc.
  const parts = text.split(SPLIT_CITATION_REGEX);

  return parts.map((part, i) => {
    const match = part.match(EXACT_CITATION_REGEX);
    if (match) {
      const sourceTitle = match[1].trim();
      const index = uniqueSources.indexOf(sourceTitle) + 1;
      
      // If we found it in our unique sources list, render the popover
      if (index > 0) {
        const matchingCitation = citations.find(c => c.sourceTitle.toLowerCase().includes(sourceTitle.toLowerCase()) || sourceTitle.toLowerCase().includes(c.sourceTitle.toLowerCase()));
        return (
          <CitationPopover
            key={i}
            index={index}
            sourceTitle={sourceTitle}
            citations={citations}
            onOpenDetail={() => {
              if (matchingCitation) onCitationClick(matchingCitation, index - 1);
            }}
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
  uniqueSources,
  onCitationClick,
}: MarkdownRendererProps) {
  const components: Components = {
    p({ children }) {
      const processChildren = (child: React.ReactNode): React.ReactNode => {
        if (typeof child === 'string') {
          return processInlineSources(child, uniqueSources, citations, onCitationClick);
        }
        return child;
      };

      const processed = Array.isArray(children)
        ? children.flatMap(processChildren)
        : processChildren(children);

      return <p className="mb-4 last:mb-0 leading-relaxed">{processed}</p>;
    },

    li({ children }) {
      const processChildren = (child: React.ReactNode): React.ReactNode => {
        if (typeof child === 'string') {
          return processInlineSources(child, uniqueSources, citations, onCitationClick);
        }
        return child;
      };

      const processed = Array.isArray(children)
        ? children.flatMap(processChildren)
        : processChildren(children);

      return <li className="mb-1 leading-relaxed">{processed}</li>;
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
