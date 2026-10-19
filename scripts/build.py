from pathlib import Path
import json
import html
import shutil

ROOT = Path(__file__).resolve().parents[1]


def esc(value):
    return html.escape(str(value), quote=True)


def concept_html(concept, sources):
    paragraphs = ''.join(
        f'<p>{esc(paragraph)}</p>'
        + (f'<div class="formula">{esc(concept["formula"])}</div>' if index == 1 else '')
        for index, paragraph in enumerate(concept['body'])
    )
    references = ' · '.join(
        f'<a href="{esc(sources[source]["url"])}">{esc(sources[source]["name"])}</a>'
        for source in concept['sources']
    )
    return (
        f'<section class="print-concept" id="{esc(concept["id"])}">'
        f'<p class="eyebrow">{esc(concept["en"])}</p>'
        f'<h3>{esc(concept["title"])}</h3>{paragraphs}<small>{references}</small></section>'
    )


def build():
    data = json.loads((ROOT / 'content/fieldbook.json').read_text(encoding='utf-8-sig'))
    data['version'] = (ROOT / 'VERSION').read_text(encoding='utf-8-sig').strip()
    ids = {concept['id'] for concept in data['concepts']}
    field_ids = {field['id'] for field in data['fields']}
    if len(ids) != len(data['concepts']):
        raise ValueError('Duplicate concept IDs')
    for concept in data['concepts']:
        for key in ['id', 'field', 'group', 'title', 'en', 'summary', 'formula']:
            if not concept.get(key):
                raise ValueError(f'Missing {key}: {concept["id"]}')
        paragraphs = concept.get('body')
        if not isinstance(paragraphs, list) or len(paragraphs) < 4 or not all(
            isinstance(paragraph, str) and paragraph.strip() for paragraph in paragraphs
        ):
            raise ValueError(f'Incomplete article: {concept["id"]}')
        if concept['field'] not in field_ids:
            raise ValueError(f'Unknown field: {concept["id"]}')
        if not all(related in ids for related in concept['related']):
            raise ValueError(f'Broken related links: {concept["id"]}')
        if not all(source in data['sources'] for source in concept['sources']):
            raise ValueError(f'Unknown source: {concept["id"]}')
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    for name in ['index.html', 'app.js', 'styles.css', 'labs.js', 'markets.js', 'manifest.webmanifest', '.nojekyll']:
        shutil.copy2(ROOT / 'site' / name, dist / name)
    shutil.copytree(ROOT / 'site/icons', dist / 'icons', dirs_exist_ok=True)
    parts, chapters = [], []
    for index, field in enumerate(data['fields'], 1):
        concepts = [concept for concept in data['concepts'] if concept['field'] == field['id']]
        markdown = [f'# {field["name"]}', field['description']]
        body = [f'<section class="print-field"><h1>{esc(field["name"])}</h1><p>{esc(field["description"])}</p>']
        for group in dict.fromkeys(concept['group'] for concept in concepts):
            body.append(f'<h2>{esc(group)}</h2>')
            markdown.append('## ' + group)
            for concept in (item for item in concepts if item['group'] == group):
                body.append(concept_html(concept, data['sources']))
                markdown.extend([f'### {concept["title"]}', *concept['body'][:2], f'`{concept["formula"]}`', *concept['body'][2:]])
                markdown.append('참고 자료: ' + ' · '.join(
                    f'[{data["sources"][source]["name"]}]({data["sources"][source]["url"]})'
                    for source in concept['sources']
                ))
        body.append('</section>')
        parts.extend(body)
        slug = f'{index:02d}_{field["id"]}'
        text = '\n\n'.join(markdown) + '\n'
        (ROOT / 'content/chapters' / f'{slug}.md').write_text(text, encoding='utf-8')
        chapters.append({'slug': slug, 'title': field['name'], 'markdown': text, 'html': '\n'.join(body)})
    glossary = '# 용어사전\n\n' + '\n\n'.join(
        f'## {field["name"]}\n\n' + '\n\n'.join(
            concept['title'] + ': ' + concept['summary']
            for concept in data['concepts'] if concept['field'] == field['id']
        ) for field in data['fields']
    )
    (ROOT / 'content/chapters/05_dictionary.md').write_text(glossary + '\n', encoding='utf-8')
    data['chapters'] = chapters
    (dist / 'content.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print_document = (
        '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Fieldbook · 금융·경제 노트</title><link rel="stylesheet" href="styles.css"></head>'
        '<body class="print-document"><header class="print-cover"><p>FIELDBOOK · '
        + esc(data['edition']) + '</p><h1>금융·경제 노트</h1><p>경제 · 금융 · 재무설계 · 법률</p>'
        '<p>법·세제의 적용 대상과 한도·세율·기한은 해당 시점의 법령과 공식 안내를 기준으로 합니다.</p>'
        '<button onclick="window.print()">인쇄 / PDF 저장</button></header>'
        + ''.join(parts) + '</body></html>'
    )
    (dist / 'finance-guide-print.html').write_text(print_document, encoding='utf-8')
    print(f'Built {len(ids)} concepts / {len(data["fields"])} fields / v{data["version"]}')


if __name__ == '__main__':
    build()
