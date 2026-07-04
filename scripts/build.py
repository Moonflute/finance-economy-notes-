from __future__ import annotations

import html
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content" / "chapters"
SITE_DIR = ROOT / "site"
DIST_DIR = ROOT / "dist"
VERSION_FILE = ROOT / "VERSION"


@dataclass
class Chapter:
    slug: str
    title: str
    markdown: str
    html: str


def inline_markdown(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def markdown_to_html(markdown: str) -> str:
    lines = markdown.splitlines()
    out: list[str] = []
    in_ul = False
    in_ol = False
    in_table = False
    table_rows: list[str] = []

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def flush_table() -> None:
        nonlocal in_table, table_rows
        if not in_table:
            return
        out.append("<table>")
        for i, row in enumerate(table_rows):
            cells = [cell.strip() for cell in row.strip("|").split("|")]
            if i == 1 and all(set(cell) <= {"-", ":", " "} for cell in cells):
                continue
            tag = "th" if i == 0 else "td"
            out.append("<tr>" + "".join(f"<{tag}>{inline_markdown(cell)}</{tag}>" for cell in cells) + "</tr>")
        out.append("</table>")
        table_rows = []
        in_table = False

    for raw in lines:
        line = raw.rstrip()
        if not line:
            flush_table()
            close_lists()
            continue
        if "|" in line and line.strip().startswith("|"):
            close_lists()
            in_table = True
            table_rows.append(line)
            continue
        flush_table()
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            close_lists()
            level = len(heading.group(1))
            out.append(f"<h{level}>{inline_markdown(heading.group(2))}</h{level}>")
            continue
        bullet = re.match(r"^\s*[-*]\s+(.+)$", line)
        if bullet:
            if in_ol:
                out.append("</ol>")
                in_ol = False
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline_markdown(bullet.group(1))}</li>")
            continue
        numbered = re.match(r"^\s*\d+\.\s+(.+)$", line)
        if numbered:
            if in_ul:
                out.append("</ul>")
                in_ul = False
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{inline_markdown(numbered.group(1))}</li>")
            continue
        close_lists()
        out.append(f"<p>{inline_markdown(line)}</p>")

    flush_table()
    close_lists()
    return "\n".join(out)


def read_chapters() -> list[Chapter]:
    chapters: list[Chapter] = []
    for path in sorted(CONTENT_DIR.glob("*.md")):
        markdown = path.read_text(encoding="utf-8")
        title = next((line[2:].strip() for line in markdown.splitlines() if line.startswith("# ")), path.stem)
        chapters.append(Chapter(path.stem, title, markdown, markdown_to_html(markdown)))
    return chapters


def read_version() -> str:
    if not VERSION_FILE.exists():
        return "0.0.0"
    version = VERSION_FILE.read_text(encoding="utf-8-sig").strip()
    return version or "0.0.0"


def build() -> None:
    DIST_DIR.mkdir(exist_ok=True)
    chapters = read_chapters()
    version = read_version()
    data = {
        "title": "대한민국 금융경제 통합 가이드",
        "version": version,
        "chapters": [
            {"slug": chapter.slug, "title": chapter.title, "html": chapter.html, "markdown": chapter.markdown}
            for chapter in chapters
        ],
    }

    for item in SITE_DIR.iterdir():
        target = DIST_DIR / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)

    (DIST_DIR / "content.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print_html = render_print_html(chapters, version)
    (DIST_DIR / "finance-guide-print.html").write_text(print_html, encoding="utf-8")
    print(f"Built {DIST_DIR}")


def render_print_html(chapters: list[Chapter], version: str) -> str:
    body = "\n".join(f"<section class=\"print-chapter\">{chapter.html}</section>" for chapter in chapters)
    escaped_version = html.escape(version)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>대한민국 금융경제 통합 가이드 - PDF</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="print-doc">
  <header class="print-cover">
    <p class="eyebrow">Finance Knowledge Guide</p>
    <h1>대한민국 금융경제 통합 가이드 <span class="app-version">v {escaped_version}</span></h1>
    <p>경제, 금융, 재무설계, 법률을 자격증 보유자 수준으로 연결해 정리한 학습·설명용 문서</p>
  </header>
  <main>{body}</main>
</body>
</html>
"""


if __name__ == "__main__":
    build()
