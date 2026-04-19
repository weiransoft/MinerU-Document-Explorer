/**
 * Pure TypeScript HTML Parser for MinerU Document Explorer.
 * Extracts structured content from HTML without Python dependencies.
 * Supports: headings, paragraphs, lists, tables, code blocks, images, links.
 */

export interface HtmlSection {
  section_idx: number;
  heading: string | null;
  level: number | null;
  text: string;
}

export interface HtmlTable {
  section_idx: number;
  html: string;
  headers: string[];
  rows: string[][];
}

export interface HtmlCodeBlock {
  section_idx: number;
  language: string | null;
  code: string;
}

export interface HtmlImage {
  section_idx: number;
  src: string;
  alt: string | null;
  title: string | null;
}

export interface HtmlLink {
  text: string;
  href: string;
}

export interface HtmlExtractionResult {
  error?: string;
  sections: HtmlSection[];
  pages: { page_idx: number; text: string; tokens: number }[];
  tables: HtmlTable[];
  code_blocks: HtmlCodeBlock[];
  images: HtmlImage[];
  links: HtmlLink[];
  metadata: {
    title: string | null;
    description: string | null;
    author: string | null;
    language: string | null;
  };
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse HTML and extract structured content.
 */
export function parseHtml(html: string, baseUrl?: string): HtmlExtractionResult {
  const sections: HtmlSection[] = [];
  const tables: HtmlTable[] = [];
  const codeBlocks: HtmlCodeBlock[] = [];
  const images: HtmlImage[] = [];
  const links: HtmlLink[] = [];

  let currentSection: HtmlSection | null = null;
  let currentText: string[] = [];
  let sectionIdx = 0;

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/i);
  const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);

  const metadata = {
    title: titleMatch ? stripHtml(titleMatch[1]) : null,
    description: descMatch ? descMatch[1] : null,
    author: authorMatch ? authorMatch[1] : null,
    language: langMatch ? langMatch[1] : null,
  };

  const normalizedHtml = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedHtml.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const headingMatch = line.match(/<h([1-6])(?:\s[^>]*)?>([^<]*)<\/h[1-6]>/i);
    if (headingMatch) {
      if (currentSection) {
        currentSection.text = currentText.join('\n').trim();
        if (currentSection.text) {
          sections.push(currentSection);
        }
      }

      const level = parseInt(headingMatch[1], 10);
      const headingText = stripHtml(headingMatch[2]);
      currentSection = {
        section_idx: sectionIdx++,
        heading: headingText,
        level,
        text: '',
      };
      currentText = [];
      i++;
      continue;
    }

    const preMatch = line.match(/<pre(?:\s[^>]*)?>([^<]*)/i);
    if (preMatch) {
      if (currentSection && currentText.length > 0) {
        currentSection.text = currentText.join('\n').trim();
        if (currentSection.text) {
          sections.push(currentSection);
        }
        currentSection = null;
        currentText = [];
      }

      let codeContent = preMatch[1];
      i++;
      while (i < lines.length && !lines[i].includes('</pre>')) {
        codeContent += '\n' + lines[i];
        i++;
      }
      codeContent = stripHtml(codeContent);

      const langMatch = line.match(/class=["'][^"']*language-(\w+)[^"']*["']/i) ||
                       line.match(/class=["'][^"']*lang-(\w+)[^"']*["']/i);
      const language = langMatch ? langMatch[1] : null;

      codeBlocks.push({
        section_idx: sections.length > 0 ? sections[sections.length - 1].section_idx : 0,
        language,
        code: codeContent,
      });
      i++;
      continue;
    }

    const pMatch = line.match(/<(?:p|div)(?:\s[^>]*)?>([^<]*)/i);
    if (pMatch) {
      const text = stripHtml(pMatch[1]);
      if (text) {
        currentText.push(text);
      }
      i++;
      continue;
    }

    const liMatch = line.match(/<li(?:\s[^>]*)?>([^<]*)/i);
    if (liMatch) {
      const text = stripHtml(liMatch[1]);
      if (text) {
        currentText.push('• ' + text);
      }
      i++;
      continue;
    }

    const tableStartMatch = line.match(/<table(?:\s[^>]*)?>/i);
    if (tableStartMatch) {
      if (currentSection) {
        currentSection.text = currentText.join('\n').trim();
        if (currentSection.text) {
          sections.push(currentSection);
        }
        currentSection = null;
        currentText = [];
      }

      let tableHtml = line;
      i++;
      while (i < lines.length && !lines[i].includes('</table>')) {
        tableHtml += '\n' + lines[i];
        i++;
      }
      tableHtml += '\n' + lines[i];
      i++;

      const headers: string[] = [];
      const rows: string[][] = [];

      const thMatches = tableHtml.matchAll(/<th[^>]*>([^<]*)<\/th>/gi);
      for (const match of thMatches) {
        headers.push(stripHtml(match[1]));
      }

      const trMatches = tableHtml.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi);
      for (const trMatch of trMatches) {
        const row: string[] = [];
        const tdMatches = trMatch[1].matchAll(/<td[^>]*>([^<]*)<\/td>/gi);
        for (const tdMatch of tdMatches) {
          row.push(stripHtml(tdMatch[1]));
        }
        if (row.length > 0) {
          rows.push(row);
        }
      }

      tables.push({
        section_idx: sections.length > 0 ? sections[sections.length - 1].section_idx : 0,
        html: tableHtml,
        headers,
        rows,
      });
      continue;
    }

    const imgMatches = line.matchAll(/<img([^>]*)>/gi);
    for (const imgMatch of imgMatches) {
      const attrs = imgMatch[1];
      const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      const titleMatch = attrs.match(/title=["']([^"']*)["']/i);

      if (srcMatch) {
        let src = srcMatch[1];

        if (baseUrl && !src.startsWith('http')) {
          try {
            const base = new URL(baseUrl);
            src = new URL(src, base).href;
          } catch {
            // Keep original src
          }
        }

        images.push({
          section_idx: sections.length > 0 ? sections[sections.length - 1].section_idx : 0,
          src,
          alt: altMatch ? altMatch[1] : null,
          title: titleMatch ? titleMatch[1] : null,
        });
      }
    }

    const linkMatches = line.matchAll(/<a([^>]*)>([^<]*)<\/a>/gi);
    for (const linkMatch of linkMatches) {
      const attrs = linkMatch[1];
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
      const linkText = stripHtml(linkMatch[2]);

      if (hrefMatch && linkText) {
        let href = hrefMatch[1];

        if (baseUrl && !href.startsWith('http') && !href.startsWith('#')) {
          try {
            const base = new URL(baseUrl);
            href = new URL(href, base).href;
          } catch {
            // Keep original href
          }
        }

        links.push({
          text: linkText,
          href,
        });
      }
    }

    i++;
  }

  if (currentSection) {
    currentSection.text = currentText.join('\n').trim();
    if (currentSection.text) {
      sections.push(currentSection);
    }
  }

  const pages = sections.map((section, idx) => ({
    page_idx: idx,
    text: section.text,
    tokens: Math.ceil(section.text.length / 4),
  }));

  return {
    sections,
    pages,
    tables,
    code_blocks: codeBlocks,
    images,
    links,
    metadata,
  };
}

/**
 * Parse HTML from a URL (requires fetch API).
 */
export async function parseHtmlFromUrl(url: string): Promise<HtmlExtractionResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        sections: [],
        pages: [],
        tables: [],
        code_blocks: [],
        images: [],
        links: [],
        metadata: { title: null, description: null, author: null, language: null },
      };
    }

    const html = await response.text();
    return parseHtml(html, url);
  } catch (error) {
    return {
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
      sections: [],
      pages: [],
      tables: [],
      code_blocks: [],
      images: [],
      links: [],
      metadata: { title: null, description: null, author: null, language: null },
    };
  }
}

/**
 * Convert HTML tables to Markdown format.
 */
export function tableToMarkdown(table: HtmlTable): string {
  if (table.rows.length === 0) return '';

  const lines: string[] = [];

  if (table.headers.length > 0) {
    lines.push('| ' + table.headers.join(' | ') + ' |');
    lines.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');
  }

  for (const row of table.rows) {
    lines.push('| ' + row.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Extract plain text from HTML.
 */
export function htmlToPlainText(html: string): string {
  return stripHtml(html);
}

/**
 * Validate if a string is a valid URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}
