/**
 * HTML Parser Tests
 * Tests for the pure TypeScript HTML parser implementation.
 */

import { describe, it, expect } from "vitest";
import {
  parseHtml,
  tableToMarkdown,
  htmlToPlainText,
  isValidUrl,
  extractDomain,
  type HtmlExtractionResult,
} from "../html-parser.js";

const TEST_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test Page</title>
  <meta name="description" content="A test page for HTML parsing">
  <meta name="author" content="Test Author">
</head>
<body>
  <h1>Main Heading</h1>
  <p>This is the first paragraph with some <strong>bold</strong> text.</p>
  <h2>Section One</h2>
  <p>Content of section one.</p>
  <h2>Section Two</h2>
  <p>Content of section two with a <a href="https://example.com">link</a>.</p>
  <h3>Subsection 2.1</h3>
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
    <li>Item 3</li>
  </ul>
  <table>
    <tr><th>Header 1</th><th>Header 2</th></tr>
    <tr><td>Data 1</td><td>Data 2</td></tr>
    <tr><td>Data 3</td><td>Data 4</td></tr>
  </table>
  <pre><code class="language-python">
def hello():
    print("Hello, World!")
  </code></pre>
  <img src="image.png" alt="Test Image" title="Image Title">
</body>
</html>
`;

describe("HTML Parser", () => {
  describe("parseHtml", () => {
    it("should extract title from HTML", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.metadata.title).toBe("Test Page");
    });

    it("should extract metadata", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.metadata.description).toBe("A test page for HTML parsing");
      expect(result.metadata.author).toBe("Test Author");
      expect(result.metadata.language).toBe("en");
    });

    it("should extract headings as sections", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.sections[0]?.heading).toBe("Main Heading");
      expect(result.sections[0]?.level).toBe(1);
    });

    it("should extract paragraph text", () => {
      const result = parseHtml(TEST_HTML);
      const sectionWithParagraph = result.sections.find(s => s.text.includes("first paragraph"));
      expect(sectionWithParagraph).toBeDefined();
    });

    it("should extract list items", () => {
      const result = parseHtml(TEST_HTML);
      const sectionWithList = result.sections.find(s => s.text.includes("Item 1"));
      expect(sectionWithList).toBeDefined();
    });

    it("should extract tables", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.tables.length).toBeGreaterThan(0);
      expect(result.tables[0]?.headers).toEqual(["Header 1", "Header 2"]);
      expect(result.tables[0]?.rows.length).toBe(2);
    });

    it("should extract code blocks", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.code_blocks.length).toBeGreaterThan(0);
      expect(result.code_blocks[0]?.language).toBe("python");
      expect(result.code_blocks[0]?.code).toContain("def hello");
    });

    it("should extract images", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.images.length).toBeGreaterThan(0);
      expect(result.images[0]?.src).toBe("image.png");
      expect(result.images[0]?.alt).toBe("Test Image");
    });

    it("should extract links", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.links[0]?.href).toBe("https://example.com");
    });

    it("should convert sections to pages", () => {
      const result = parseHtml(TEST_HTML);
      expect(result.pages.length).toBe(result.sections.length);
      expect(result.pages[0]?.page_idx).toBe(0);
      expect(result.pages[0]?.tokens).toBeGreaterThan(0);
    });
  });

  describe("parseHtml with baseUrl", () => {
    it("should resolve relative URLs", () => {
      const html = '<a href="/page">Link</a><img src="image.png">';
      const result = parseHtml(html, "https://example.com/path/page.html");

      const link = result.links[0];
      expect(link?.href).toBe("https://example.com/page");

      const img = result.images[0];
      expect(img?.src).toBe("https://example.com/image.png");
    });
  });

  describe("tableToMarkdown", () => {
    it("should convert table to markdown format", () => {
      const table = {
        section_idx: 0,
        html: "<table>...</table>",
        headers: ["Col1", "Col2"],
        rows: [["a", "b"], ["c", "d"]],
      };

      const markdown = tableToMarkdown(table);
      expect(markdown).toContain("| Col1 | Col2 |");
      expect(markdown).toContain("| --- | --- |");
      expect(markdown).toContain("| a | b |");
    });

    it("should return empty string for empty table", () => {
      const table = {
        section_idx: 0,
        html: "",
        headers: [],
        rows: [],
      };
      expect(tableToMarkdown(table)).toBe("");
    });
  });

  describe("htmlToPlainText", () => {
    it("should strip HTML tags", () => {
      expect(htmlToPlainText("<p>Hello <strong>World</strong></p>")).toBe("Hello World");
    });

    it("should decode HTML entities", () => {
      expect(htmlToPlainText("&amp; &lt; &gt; &quot;")).toBe("& < > \"");
    });
  });

  describe("isValidUrl", () => {
    it("should validate correct URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://example.com/path")).toBe(true);
      expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not a url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });

  describe("extractDomain", () => {
    it("should extract domain from URL", () => {
      expect(extractDomain("https://example.com/path")).toBe("example.com");
      expect(extractDomain("https://www.example.com/path")).toBe("www.example.com");
    });

    it("should return null for invalid URL", () => {
      expect(extractDomain("not a url")).toBeNull();
    });
  });
});
