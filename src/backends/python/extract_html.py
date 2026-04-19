#!/usr/bin/env python3
"""
Extract content from HTML files or URLs.

Usage:
    extract_html.py <filepath_or_url>

Output (stdout, JSON):
    {
        "pages": [{"page_idx": N, "text": "...", "tokens": N}],
        "sections": [{"section_idx": N, "heading": "...", "level": N, "text": "..."}],
        "tables": [{"section_idx": N, "html": "..."}],
        "error": "..." (optional)
    }
"""
import sys
import json
import requests
from bs4 import BeautifulSoup
from collections import defaultdict

def is_url(path):
    return path.startswith('http://') or path.startswith('https://')

def extract_content(soup):
    """Extract structured content from HTML."""
    # Extract headings and sections
    sections = []
    current_section = None
    current_level = 0
    current_text = []
    
    # Extract tables
    tables = []
    table_idx = 0
    
    # Walk through all elements
    for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'table']):
        if element.name.startswith('h'):
            # Save current section if exists
            if current_section:
                current_section['text'] = '\n'.join(current_text).strip()
                sections.append(current_section)
            
            # Start new section
            level = int(element.name[1])
            current_section = {
                'section_idx': len(sections),
                'heading': element.get_text(strip=True),
                'level': level,
                'text': ''
            }
            current_level = level
            current_text = []
        
        elif element.name == 'table':
            # Extract table as HTML
            table_html = str(element)
            tables.append({
                'section_idx': len(sections) if current_section else 0,
                'html': table_html
            })
        
        elif element.name in ['p', 'div']:
            # Add text content
            text = element.get_text(strip=True)
            if text:
                current_text.append(text)
    
    # Save last section
    if current_section:
        current_section['text'] = '\n'.join(current_text).strip()
        sections.append(current_section)
    
    # Convert sections to pages (1 section per page for simplicity)
    pages = []
    for idx, section in enumerate(sections):
        pages.append({
            'page_idx': idx,
            'text': section['text'],
            'tokens': len(section['text']) // 4
        })
    
    return sections, pages, tables

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: extract_html.py <filepath_or_url>"}))
        sys.exit(1)
    
    path = sys.argv[1]
    
    try:
        if is_url(path):
            # Fetch from URL
            response = requests.get(path, timeout=30)
            response.raise_for_status()
            content = response.text
        else:
            # Read from file
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        # Parse HTML
        soup = BeautifulSoup(content, 'html.parser')
        
        # Extract content
        sections, pages, tables = extract_content(soup)
        
        # Build result
        result = {
            'sections': sections,
            'pages': pages,
            'tables': tables
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Extraction failed: {e}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()