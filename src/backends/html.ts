import type { DocumentBackend, TocSection, GrepMatch, QueryChunk, ContentSection } from "./types.js";
import type { Store } from "../store.js";
import { readFileSync } from "node:fs";
import { parseHtml, parseHtmlFromUrl, isValidUrl, tableToMarkdown } from "./html-parser.js";
import { BackendDb, err, Address, Content, Grep as SharedGrep } from "./shared.js";

function sectionsToToc(sections: any[]): TocSection[] {
  if (!Array.isArray(sections)) return [];
  return sections.map(section => ({
    title: section.heading ?? "Untitled",
    level: section.level ?? 1,
    address: `sections:${section.section_idx}`,
    children: [],
  }));
}

export function createHtmlBackend(store: Store): DocumentBackend {
  const db = store.db;
  const backendDb = new BackendDb(db);

  function getCache(db: any, docid: string, table: string) {
    return db.prepare(`SELECT * FROM ${table} WHERE docid = ?`).all(docid);
  }

  return {
    format: "html",

    async getToc(filepath: string, docid: string): Promise<TocSection[]> {
      const cached = db.prepare(
        "SELECT sections, source FROM toc_cache WHERE docid = ?"
      ).get(docid) as { sections: string; source: string } | undefined;
      if (cached) {
        try { return JSON.parse(cached.sections) as TocSection[]; } catch { db.prepare("DELETE FROM toc_cache WHERE docid = ?").run(docid); }
      }

      let result;
      if (isValidUrl(filepath)) {
        result = await parseHtmlFromUrl(filepath);
      } else {
        try {
          const html = readFileSync(filepath, "utf-8");
          result = parseHtml(html);
        } catch { return []; }
      }

      if (result.error) return [];

      const sections = result.sections ?? [];
      const tree = sectionsToToc(sections);
      if (tree.length > 0) {
        db.prepare(
          "INSERT OR REPLACE INTO toc_cache (docid, sections, source, created_at) VALUES (?, ?, ?, ?)"
        ).run(docid, JSON.stringify(tree), "html_sections", Date.now());
      }
      return tree;
    },

    async readContent(filepath: string, docid: string, addresses: string[], maxTokens = 2000): Promise<ContentSection[]> {
      const results: ContentSection[] = [];

      for (const address of addresses) {
        const sectionRange = Address.parseSections(address);
        if (!sectionRange) {
          results.push(Content.section(address, err("INVALID_ADDRESS").message, maxTokens));
          continue;
        }

        const { from, to } = sectionRange;
        const rows = db.prepare(
          "SELECT section_idx, text, source FROM sections_cache WHERE docid = ? AND section_idx >= ? AND section_idx <= ? ORDER BY section_idx"
        ).all(docid, from, to) as { section_idx: number; text: string; source: string }[];

        if (rows.length === 0) {
          results.push({
            address,
            text: "HTML not indexed with section cache. Re-index with 'qmd update'.",
            num_tokens: 0,
          });
          continue;
        }

        const text = rows.map(r => r.text).join("\n\n---\n\n");
        const source = rows[0]!.source;
        results.push(Content.section(address, text, maxTokens, { source }));
      }

      return results;
    },

    async grep(filepath: string, docid: string, pattern: string, flags = "gi"): Promise<GrepMatch[]> {
      const rows = db.prepare(
        "SELECT section_idx, text FROM sections_cache WHERE docid = ? ORDER BY section_idx"
      ).all(docid) as { section_idx: number; text: string }[];

      if (rows.length === 0) return [];

      const re = SharedGrep.createRegex(pattern, flags);
      const matches: GrepMatch[] = [];

      for (const row of rows) {
        let found: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((found = re.exec(row.text)) !== null) {
          const content = SharedGrep.extractContext(row.text, found.index, found[0].length, 250);
          matches.push({
            address: `sections:${row.section_idx}`,
            content,
            match: found[0],
            location: { section_idx: row.section_idx },
          });
        }
      }

      return matches;
    },

    async query(filepath: string, docid: string, queryText: string, topK = 5): Promise<QueryChunk[]> {
      const { hash, body } = backendDb.getHashAndBody(docid);

      const sectionRows = db.prepare(
        "SELECT section_idx, text FROM sections_cache WHERE docid = ? ORDER BY section_idx"
      ).all(docid) as { section_idx: number; text: string }[];

      const sectionOffsets: number[] = [];
      let offset = 0;
      for (const section of sectionRows) {
        sectionOffsets.push(offset);
        offset += section.text.length + 2;
      }

      function posToSectionIdx(pos: number): number {
        let lo = 0, hi = sectionOffsets.length - 1;
        while (lo < hi) {
          const mid = Math.floor((lo + hi + 1) / 2);
          if (sectionOffsets[mid]! <= pos) lo = mid;
          else hi = mid - 1;
        }
        return sectionRows[lo]?.section_idx ?? 0;
      }

      return queryWithEmbeddings(
        store, hash, body, queryText, topK,
        (pos) => {
          const sectionIdx = sectionRows.length > 0 ? posToSectionIdx(pos) : 0;
          return { address: `sections:${sectionIdx}`, location: { section_idx: sectionIdx } };
        },
        createGrepFallback(this, filepath, docid, queryText, topK),
      );
    },

    async extractElements(filepath: string, docid: string, _addresses?: string[], _query?: string, elementTypes?: ("table" | "figure" | "equation")[]) {
      const types = elementTypes ?? ["table", "figure", "equation"];
      const results: any[] = [];

      if (types.includes("table")) {
        const tables = db.prepare(
          "SELECT section_idx, html FROM sections_cache WHERE docid = ? AND source = 'html'"
        ).all(docid) as { section_idx: number; html: string }[];

        for (const table of tables) {
          try {
            const parsed = parseHtml(table.html);
            if (parsed.tables.length > 0) {
              for (const t of parsed.tables) {
                results.push({
                  address: `sections:${table.section_idx}`,
                  element_type: "table",
                  content: tableToMarkdown(t),
                  crop_path: undefined,
                });
              }
            }
          } catch { /* skip invalid tables */ }
        }
      }

      if (types.includes("figure")) {
        const images = db.prepare(
          "SELECT section_idx, html FROM sections_cache WHERE docid = ? AND source = 'html'"
        ).all(docid) as { section_idx: number; html: string }[];

        for (const image of images) {
          try {
            const parsed = parseHtml(image.html);
            if (parsed.images.length > 0) {
              for (const img of parsed.images) {
                results.push({
                  address: `sections:${image.section_idx}`,
                  element_type: "figure",
                  content: `![${img.alt ?? 'image'}](${img.src})`,
                  crop_path: img.src,
                });
              }
            }
          } catch { /* skip invalid images */ }
        }
      }

      return results;
    },
  };
}
