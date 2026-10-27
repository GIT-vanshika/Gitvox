import React from 'react';
import { parseAssistantMarkdown } from '../../services/assistantMarkdown';

function InlineText({ text }: { text: string }) {
  const safeText = text.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[^>]+>/g, '');
  const parts = safeText.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="rounded border border-line bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-accent"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <em key={index} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}

function cleanTableCell(text: string): string {
  return text.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[^>]+>/g, '');
}

/**
 * Readable, safe rendering for the model's Markdown answer. No HTML injection:
 * only the structured blocks and inline emphasis are rendered.
 */
export const AssistantMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = parseAssistantMarkdown(text);

  return (
    <div className="space-y-3 text-[13px] leading-6 text-body">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return block.level === 3 ? (
              <h4 key={index} className="pt-1 text-[13px] font-semibold tracking-tight text-ink">
                <InlineText text={block.text} />
              </h4>
            ) : (
              <h3
                key={index}
                className={`pt-2 text-[15px] font-semibold tracking-tight text-ink ${
                  index === 0 ? 'pt-0' : ''
                }`}
              >
                <InlineText text={block.text} />
              </h3>
            );
          case 'paragraph':
            return (
              <p key={index}>
                <InlineText text={block.text} />
              </p>
            );
          case 'bullet-list':
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-faint">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
          case 'ordered-list':
            return (
              <ol key={index} className="list-decimal space-y-1.5 pl-5 marker:text-faint">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={index}
                className="border-l-2 border-line-strong pl-3 font-mono text-[11px] leading-relaxed text-body"
              >
                <InlineText text={block.text} />
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-md border border-line bg-soft p-3 font-mono text-[11px] leading-relaxed text-ink"
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={index} className="overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-soft">
                    <tr>
                      {block.headers.map((header, headerIndex) => (
                        <th
                          key={headerIndex}
                          className="border-b border-line px-2.5 py-2 text-left font-semibold text-ink"
                        >
                          <InlineText text={cleanTableCell(header)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border-b border-line px-2.5 py-2 align-top text-body last:border-b-0"
                          >
                            <InlineText text={cleanTableCell(cell)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'divider':
            return <hr key={index} className="border-line" />;
          default:
            return null;
        }
      })}
    </div>
  );
};
