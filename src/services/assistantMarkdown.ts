export type AssistantBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; language: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'divider' };

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const BULLET_PATTERN = /^[-*]\s+(.+)$/;
const ORDERED_PATTERN = /^\d+[.)]\s+(.+)$/;
const DIVIDER_PATTERN = /^-{3,}$/;
const CODE_FENCE_PATTERN = /^```([A-Za-z0-9_-]*)\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\|?[\s:|-]+\|[\s:|-]*$/;

function splitTableRow(row: string): string[] {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Small, dependency-free Markdown block parser for model answers. It renders
 * text, headings, lists, quotes, code fences, and dividers without using HTML
 * injection, so model output cannot introduce script or markup.
 */
export function parseAssistantMarkdown(markdown: string): AssistantBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: AssistantBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length > 0) {
      blocks.push({ type: 'bullet-list', items: bullets });
      bullets = [];
    }
  };
  const flushOrdered = () => {
    if (ordered.length > 0) {
      blocks.push({ type: 'ordered-list', items: ordered });
      ordered = [];
    }
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      blocks.push({ type: 'quote', text: quote.join(' ').trim() });
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushOrdered();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (line.trim().length === 0) {
      flushAll();
      continue;
    }

    const fence = line.trim().match(CODE_FENCE_PATTERN);
    if (fence) {
      flushAll();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', language: fence[1] || '', text: codeLines.join('\n') });
      continue;
    }

    if (DIVIDER_PATTERN.test(line.trim())) {
      flushAll();
      blocks.push({ type: 'divider' });
      continue;
    }

    const heading = line.trim().match(HEADING_PATTERN);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: Math.min(3, heading[1].length) as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const nextLine = index + 1 < lines.length ? lines[index + 1].trim() : '';
    if (
      line.trim().includes('|') &&
      nextLine.includes('-') &&
      TABLE_SEPARATOR_PATTERN.test(nextLine)
    ) {
      flushAll();
      const headers = splitTableRow(line.trim());
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = lines[index].trim();
        if (!row || !row.includes('|')) break;
        rows.push(splitTableRow(row));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      index -= 1;
      continue;
    }

    const bullet = line.trim().match(BULLET_PATTERN);
    if (bullet) {
      flushParagraph();
      flushOrdered();
      flushQuote();
      bullets.push(bullet[1].trim());
      continue;
    }

    const orderedItem = line.trim().match(ORDERED_PATTERN);
    if (orderedItem) {
      flushParagraph();
      flushBullets();
      flushQuote();
      ordered.push(orderedItem[1].trim());
      continue;
    }

    if (line.trim().startsWith('>')) {
      flushParagraph();
      flushBullets();
      flushOrdered();
      quote.push(line.trim().replace(/^>\s?/, ''));
      continue;
    }

    flushBullets();
    flushOrdered();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}