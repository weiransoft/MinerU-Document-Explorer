# MinerU Document Explorer HTML 网页解析集成指南

## 概述

MinerU Document Explorer 现在支持 HTML 网页内容的解析和索引，包括本地 HTML 文件和远程 URL。

### 支持的功能

| 功能 | 说明 |
|------|------|
| 本地 HTML 文件 | 解析 `.html` 和 `.htm` 文件 |
| 远程 URL | 直接从网页 URL 提取内容 |
| 标题提取 | 自动识别 h1-h6 标题生成目录 |
| 段落提取 | 提取文本段落和列表项 |
| 表格提取 | 提取表格并转换为 Markdown |
| 图片提取 | 提取图片链接和 alt 属性 |
| 链接提取 | 提取超链接信息 |
| 元数据提取 | title、description、author 等 |

---

## 安装

### 1. 安装 Node.js 依赖

```bash
cd /home/hguser/MinerU-Document-Explorer
npm install
```

### 2. 安装 Python 依赖（可选，用于高级 PDF 处理）

```bash
pip install pymupdf python-docx python-pptx beautifulsoup4 requests
```

### 3. 验证安装

```bash
qmd --version
```

---

## 基本使用

### 索引 HTML 文件

```bash
# 索引当前目录下的所有 HTML 文件
qmd update --pattern "**/*.html"

# 索引指定目录
qmd update /path/to/html/files --pattern "**/*.html"
```

### 索引远程 URL

```bash
# 使用 curl 下载后索引
curl -o page.html https://example.com
qmd update --pattern "page.html"

# 或直接通过 MCP 工具处理
```

### 搜索内容

```bash
# 全局搜索
qmd search "关键词"

# 在特定集合中搜索
qmd search "关键词" --collection my-collection
```

### 查看目录

```bash
# 查看文档目录结构
qmd doc-toc page.html

# 输出示例
# ├── Introduction (h1)
# │   └── Getting Started (h2)
# │       └── Installation (h3)
# └── Features (h1)
#     └── HTML Support (h2)
```

### 读取内容

```bash
# 读取第一个章节
qmd doc-read page.html "sections:0"

# 读取多个章节
qmd doc-read page.html "sections:0-2"

# 按行读取（如果支持）
qmd doc-read page.html "line:100-200"
```

### 搜索文档内内容

```bash
# 在文档中搜索关键词
qmd doc-grep page.html "关键词"

# 使用正则表达式
qmd doc-grep page.html "pattern.*regex"
```

---

## MCP 服务器集成

### 启动 MCP 服务器

```bash
# 启动 HTTP 模式（推荐）
qmd mcp --http --daemon

# 或使用默认端口
qmd mcp --http --daemon --port 8181
```

### MCP 工具列表

| 工具 | 说明 |
|------|------|
| `doc_toc` | 获取文档目录 |
| `doc_read` | 读取文档内容 |
| `doc_grep` | 文档内搜索 |
| `doc_query` | 语义查询 |
| `doc_elements` | 提取表格/图片 |
| `collection_create` | 创建集合 |
| `collection_update` | 更新集合 |
| `collection_query` | 搜索集合 |
| `wiki_search` | Wiki 搜索 |
| `wiki_write` | 写入 Wiki |

### MCP 客户端配置

**Cursor (HTTP 模式):**

```json
{
  "mcpServers": {
    "qmd": {
      "url": "http://localhost:8181/mcp"
    }
  }
}
```

**Claude Desktop (stdio 模式):**

```json
{
  "mcpServers": {
    "qmd": {
      "command": "qmd",
      "args": ["mcp"]
    }
  }
}
```

---

## Python API 使用

### 直接使用 HTML 解析器

```python
import json

# 使用 TypeScript 解析器（需要 Node.js）
import { spawn } from 'child_process'

def parse_html(file_path):
    result = spawn('node', ['-e', f'''
    const {{ parseHtml, parseHtmlFromUrl }} = require('./src/backends/html-parser.ts');
    const path = require('path');
    const fs = require('fs');

    if (path.startsWith('http')) {{
      parseHtmlFromUrl(path).then(console.log);
    }} else {{
      const html = fs.readFileSync(path, 'utf-8');
      console.log(parseHtml(html));
    }}
    ''', file_path])

# 使用 Python 备用脚本
def parse_html_python(file_path):
    import subprocess
    result = subprocess.run(
        ['python3', 'src/backends/python/extract_html.py', file_path],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)
```

### 集成到现有系统

```python
import requests

# 通过 API 调用
response = requests.post(
    'http://localhost:8181/mcp',
    json={
        "method": "tools/call",
        "params": {
            "name": "doc_toc",
            "arguments": {"filepath": "/path/to/page.html"}
        }
    }
)
```

---

## 代码示例

### 示例 1: 索引网页并查询

```bash
# 1. 下载网页
curl -o example.html https://example.com

# 2. 索引
qmd update --pattern "example.html"

# 3. 获取目录
qmd doc-toc example.html

# 4. 读取内容
qmd doc-read example.html "sections:0"

# 5. 搜索
qmd doc-grep example.html "关键词"
```

### 示例 2: 批量处理 URL

```bash
#!/bin/bash
# batch_index.sh

URLS=(
    "https://example.com/page1.html"
    "https://example.com/page2.html"
    "https://example.com/page3.html"
)

for url in "${URLS[@]}"; do
    filename=$(basename "$url")
    echo "Downloading: $url"
    curl -s -o "$filename" "$url"

    echo "Indexing: $filename"
    qmd update --pattern "$filename"
done

echo "Done!"
```

### 示例 3: Python 批量处理

```python
import subprocess
import requests
from pathlib import Path

def download_and_index(url, collection="default"):
    # 下载
    filename = Path(url).name
    response = requests.get(url)
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(response.text)

    # 索引
    subprocess.run(['qmd', 'update', '--pattern', filename, '--collection', collection])
    return filename

# 批量处理
urls = [
    "https://example.com/page1.html",
    "https://example.com/page2.html",
]

for url in urls:
    download_and_index(url)
```

---

## 高级配置

### 自定义解析选项

编辑 `~/.config/qmd/doc-reading.json`:

```json
{
  "docReading": {
    "html": {
      "extractTables": true,
      "extractImages": true,
      "extractLinks": true,
      "extractCodeBlocks": true,
      "maxSectionLength": 5000
    }
  }
}
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MINERU_MODEL_SOURCE` | huggingface | 模型源 (huggingface/modelscope) |
| `MINERU_API_KEY` | - | MinerU Cloud API 密钥 |
| `QMD_PORT` | 8181 | MCP 服务器端口 |
| `QMD_HOST` | localhost | MCP 服务器地址 |

---

## 故障排除

### 问题 1: HTML 文件未正确解析

```bash
# 检查文件编码
file page.html

# 如果是 GBK 编码，转换为 UTF-8
iconv -f GBK -t UTF-8 page.html -o page_utf8.html
```

### 问题 2: URL 无法访问

```bash
# 检查网络连接
curl -I https://example.com

# 检查 User-Agent
curl -A "Mozilla/5.0" -o page.html https://example.com
```

### 问题 3: 索引失败

```bash
# 启用调试模式
qmd update --pattern "*.html" --verbose

# 检查 Python 依赖
python3 -c "import bs4; print('beautifulsoup4 OK')"
```

---

## 技术细节

### HTML 解析流程

```
1. 读取 HTML 文件/获取 URL 内容
   ↓
2. 解析 HTML 结构
   ├── <title> → 文档标题
   ├── <h1>-<h6> → 章节标题
   ├── <p>, <div> → 段落内容
   ├── <ul>, <ol> → 列表项
   ├── <table> → 表格数据
   ├── <img> → 图片信息
   └── <a> → 链接信息
   ↓
3. 构建 sections_cache 表
   ↓
4. 生成 TOC (Table of Contents)
   ↓
5. 存储到 SQLite 数据库
```

### 数据存储

| 表名 | 说明 |
|------|------|
| `documents` | 文档元数据 |
| `content` | 文档内容向量 |
| `toc_cache` | 目录缓存 |
| `sections_cache` | 章节内容缓存 (HTML) |
| `slide_cache` | PPTX 幻灯片缓存 |

---

## 相关资源

- [MinerU Document Explorer 主仓库](https://github.com/opendatalab/MinerU-Document-Explorer)
- [MinerU 主项目](https://github.com/opendatalab/MinerU)
- [QMD 文档](https://github.com/tobi/qmd)
- [MCP 协议文档](https://modelcontextprotocol.io)
