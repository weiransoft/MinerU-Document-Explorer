#!/usr/bin/env python3
"""Fixed HTML Parser Test - standalone version."""

import re
import sys

def strip_html(html):
    return re.sub(r'<[^>]*>', '', html) \
        .replace('&nbsp;', ' ') \
        .replace('&amp;', '&') \
        .replace('&lt;', '<') \
        .replace('&gt;', '>') \
        .replace('&quot;', '"') \
        .replace('&#39;', "'") \
        .strip()

def parse_html_basic(html):
    sections = []
    tables = []
    images = []
    links = []

    title_match = re.search(r'<title[^>]*>([^<]*)</title>', html, re.IGNORECASE)
    title = strip_html(title_match.group(1)) if title_match else None

    heading_pattern = re.compile(r'<h([1-6])(?:\s[^>]*)?>([^<]*)</h[1-6]>', re.IGNORECASE)

    last_end = 0
    current_level = 1
    current_heading = title or 'Untitled'
    current_text = []

    for match in heading_pattern.finditer(html):
        level = int(match.group(1))
        heading_text = strip_html(match.group(2))
        start = match.start()

        content_between = html[last_end:start]
        _extract_content(content_between, current_text, tables, images, links, len(sections))

        if current_text:
            sections.append({
                'section_idx': len(sections),
                'heading': current_heading,
                'level': current_level,
                'text': '\n'.join(current_text).strip()
            })
            current_text = []

        current_heading = heading_text
        current_level = level
        last_end = match.end()

    content_after = html[last_end:]
    _extract_content(content_after, current_text, tables, images, links, len(sections))

    if current_text:
        sections.append({
            'section_idx': len(sections),
            'heading': current_heading,
            'level': current_level,
            'text': '\n'.join(current_text).strip()
        })

    if not sections:
        sections.append({
            'section_idx': 0,
            'heading': title or 'Untitled',
            'level': 1,
            'text': ''
        })

    return {
        'sections': sections,
        'tables': tables,
        'images': images,
        'links': links,
        'metadata': {'title': title, 'description': None, 'author': None, 'language': None}
    }

def _extract_content(content, text_buffer, tables, images, links, section_idx):
    for p_match in re.finditer(r'<p(?:\s[^>]*)?>([\s\S]*?)</p>', content, re.IGNORECASE):
        text = strip_html(p_match.group(1))
        if text:
            text_buffer.append(text)

    for li_match in re.finditer(r'<li(?:\s[^>]*)?>([\s\S]*?)</li>', content, re.IGNORECASE):
        text = strip_html(li_match.group(1))
        if text:
            text_buffer.append('• ' + text)

    for table_match in re.finditer(r'<table[^>]*>([\s\S]*?)</table>', content, re.IGNORECASE):
        table_html = table_match.group(1)
        headers = [strip_html(th) for th in re.findall(r'<th[^>]*>([\s\S]*?)</th>', table_html, re.IGNORECASE)]
        rows = []
        for tr_match in re.finditer(r'<tr[^>]*>([\s\S]*?)</tr>', table_html, re.IGNORECASE):
            row = [strip_html(td) for td in re.findall(r'<td[^>]*>([\s\S]*?)</td>', tr_match.group(1), re.IGNORECASE)]
            if row:
                rows.append(row)
        tables.append({'section_idx': section_idx, 'headers': headers, 'rows': rows})

    for img_match in re.finditer(r'<img([^>]*)>', content, re.IGNORECASE):
        attrs = img_match.group(1)
        src_match = re.search(r'src=["\']([^"\']*)["\']', attrs, re.IGNORECASE)
        alt_match = re.search(r'alt=["\']([^"\']*)["\']', attrs, re.IGNORECASE)
        if src_match:
            images.append({'section_idx': section_idx, 'src': src_match.group(1), 'alt': alt_match.group(1) if alt_match else None})

    for link_match in re.finditer(r'<a([^>]*)>([\s\S]*?)</a>', content, re.IGNORECASE):
        attrs = link_match.group(1)
        href_match = re.search(r'href=["\']([^"\']*)["\']', attrs, re.IGNORECASE)
        link_text = strip_html(link_match.group(2))
        if href_match and link_text:
            links.append({'text': link_text, 'href': href_match.group(1)})

def table_to_markdown(table):
    if not table.get('rows'):
        return ''
    lines = []
    if table.get('headers'):
        lines.append('| ' + ' | '.join(table['headers']) + ' |')
        lines.append('| ' + ' | '.join(['---'] * len(table['headers'])) + ' |')
    for row in table['rows']:
        lines.append('| ' + ' | '.join(row) + ' |')
    return '\n'.join(lines)

# Inline TEST_HTML
TEST_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test Page</title>
  <meta name="description" content="A test page for HTML parsing">
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
  </table>
  <img src="image.png" alt="Test Image">
</body>
</html>
"""

def run_tests():
    print("Running HTML Parser Tests...")
    print("=" * 50)

    result = parse_html_basic(TEST_HTML)

    assert result['metadata']['title'] == 'Test Page', f"Title failed: {result['metadata']['title']}"
    print("✓ Title extraction works")

    assert len(result['sections']) > 0, "No sections extracted"
    assert result['sections'][0]['heading'] == 'Main Heading', f"First heading wrong: {result['sections'][0]['heading']}"
    print(f"✓ Section extraction works ({len(result['sections'])} sections)")

    section_with_para = any('first paragraph' in s['text'] for s in result['sections'])
    assert section_with_para, f"Paragraph not found. Sections: {[(s['heading'], s['text'][:30]) for s in result['sections']]}"
    print("✓ Paragraph extraction works")

    list_section = any('Item 1' in s['text'] for s in result['sections'])
    assert list_section, "List items not found"
    print("✓ List extraction works")

    assert len(result['tables']) > 0, "No tables extracted"
    assert result['tables'][0]['headers'] == ['Header 1', 'Header 2'], f"Table headers wrong: {result['tables'][0]['headers']}"
    print("✓ Table extraction works")

    assert len(result['images']) > 0, "No images extracted"
    assert result['images'][0]['src'] == 'image.png', f"Image src wrong: {result['images'][0]['src']}"
    print("✓ Image extraction works")

    assert len(result['links']) > 0, "No links extracted"
    assert result['links'][0]['href'] == 'https://example.com', f"Link href wrong: {result['links'][0]['href']}"
    print("✓ Link extraction works")

    md = table_to_markdown(result['tables'][0])
    assert '| Header 1 | Header 2 |' in md, f"Markdown table wrong: {md}"
    assert '| --- | --- |' in md, f"Markdown separator wrong"
    print("✓ Table to Markdown conversion works")

    assert strip_html('<p>Hello <strong>World</strong></p>') == 'Hello World', "strip_html failed"
    print("✓ HTML stripping works")

    print("=" * 50)
    print("All tests passed! ✓")

    print("\n--- Sample Parsed Content ---")
    for section in result['sections'][:5]:
        print(f"\n[{section['level']}] {section['heading']}")
        if section['text']:
            print(f"  {section['text'][:80]}...")

if __name__ == "__main__":
    try:
        run_tests()
    except AssertionError as e:
        print(f"Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")
        sys.exit(1)
