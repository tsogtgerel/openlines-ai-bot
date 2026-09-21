import React from 'react';
import { ExternalLink } from 'lucide-react';

interface FormattedMessageTextProps {
  text: string;
  isOperator?: boolean;
}

export const FormattedMessageText: React.FC<FormattedMessageTextProps> = ({ text, isOperator = false }) => {
  if (!text) return null;

  // Split by lines to maintain paragraphs
  const lines = text.split('\n');

  return (
    <div className="space-y-1 whitespace-pre-wrap leading-relaxed">
      {lines.map((line, lineIdx) => (
        <p key={lineIdx} className="min-h-[1.25em]">
          {renderLineContent(line, isOperator)}
        </p>
      ))}
    </div>
  );
};

function renderLineContent(line: string, isOperator: boolean): React.ReactNode[] {
  // Regex to match markdown links [label](url) and plain urls (https?://\S+)
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      elements.push(renderStyledText(line.slice(lastIndex, match.index), `txt-${lastIndex}`));
    }

    if (match[1] && match[2]) {
      // [label](url)
      const label = match[1];
      const url = match[2];
      const isProductLink = url.includes('/product/') || url.includes('/p/');
      const isCategoryLink = url.includes('/category/') || url.includes('/c/');

      elements.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 font-semibold underline underline-offset-2 px-1.5 py-0.5 rounded transition-colors text-xs ${
            isOperator
              ? 'bg-emerald-700/80 hover:bg-emerald-800 text-white'
              : isCategoryLink
              ? 'bg-amber-100/90 hover:bg-amber-200 text-amber-900 border border-amber-300'
              : isProductLink
              ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300'
              : 'bg-slate-100 hover:bg-slate-200 text-blue-700 border border-slate-300'
          }`}
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
        </a>
      );
    } else if (match[3]) {
      // plain url
      const url = match[3];
      elements.push(
        <a
          key={`plain-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 underline underline-offset-2 break-all text-xs font-medium ${
            isOperator ? 'text-emerald-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'
          }`}
        >
          <span>{url}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0" />
        </a>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < line.length) {
    elements.push(renderStyledText(line.slice(lastIndex), `txt-${lastIndex}`));
  }

  return elements.length > 0 ? elements : [line];
}

function renderStyledText(text: string, keyPrefix: string): React.ReactNode {
  // Support **bold**
  if (!text.includes('**')) {
    return text;
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={keyPrefix}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-bold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </React.Fragment>
  );
}
