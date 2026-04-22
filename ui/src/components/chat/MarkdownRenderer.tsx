import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({
  content,
}: MarkdownRendererProps) {
  const components: Components = {

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
