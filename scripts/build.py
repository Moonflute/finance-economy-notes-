from pathlib import Path
import json, html, shutil
ROOT=Path(__file__).resolve().parents[1]

def esc(value):return html.escape(str(value),quote=True)
def concept_html(c,sources):
    refs=' · '.join(f'<a href="{esc(sources[s]["url"])}">{esc(sources[s]["name"])}</a>' for s in c['sources'])
    return f'''<section class="print-concept" id="{c['id']}"><p class="eyebrow">{esc(c['en'])}</p><h3>{esc(c['title'])}</h3><p class="print-cue">{esc(c['cue'])}</p><p>{esc(c['summary'])}</p><div class="formula">{esc(c['formula'])}</div><h4>예시</h4><p>{esc(c['example'])}</p><h4>원리와 연결</h4><p>{esc(c['detail'])}</p><p class="print-trap"><b>구분할 점</b> {esc(c['trap'])}</p><small>{refs}</small></section>'''

def build():
    data=json.loads((ROOT/'content/fieldbook.json').read_text(encoding='utf-8-sig'))
    data['version']=(ROOT/'VERSION').read_text(encoding='utf-8-sig').strip()
    ids={c['id'] for c in data['concepts']}
    if len(ids)!=len(data['concepts']):raise ValueError('Duplicate concept IDs')
    for c in data['concepts']:
        for key in ['id','field','group','title','cue','summary','formula','example','detail','trap']:
            if not c.get(key):raise ValueError(f'Missing {key}: {c["id"]}')
        if not all(x in ids for x in c['related']):raise ValueError(f'Broken related links: {c["id"]}')
        if not all(x in data['sources'] for x in c['sources']):raise ValueError('Unknown source')
    for path in data['paths']:
        if not all(x in ids for x in path['nodes']):raise ValueError('Broken path')
    dist=ROOT/'dist';dist.mkdir(exist_ok=True)
    for name in ['index.html','app.js','styles.css','labs.js','markets.js','manifest.webmanifest','.nojekyll']:
        shutil.copy2(ROOT/'site'/name,dist/name)
    shutil.copytree(ROOT/'site/icons',dist/'icons',dirs_exist_ok=True)
    parts=[]; chapters=[]
    for index,field in enumerate(data['fields'],1):
        cs=[c for c in data['concepts'] if c['field']==field['id']]
        markdown=[f'# {field["name"]}',field['description']]
        body=[f'<section class="print-field"><h1>{esc(field["name"])}</h1><p>{esc(field["description"])}</p>']
        for group in dict.fromkeys(c['group'] for c in cs):
            body.append(f'<h2>{esc(group)}</h2>');markdown.append('## '+group)
            for c in [x for x in cs if x['group']==group]:
                body.append(concept_html(c,data['sources']))
                markdown.extend([f'### {c["title"]}',c['cue'],c['summary'],f'`{c["formula"]}`',f'**예시** {c["example"]}',f'**원리와 연결** {c["detail"]}',f'**구분할 점** {c["trap"]}','관련 개념: '+', '.join(next(x['title'] for x in data['concepts'] if x['id']==r) for r in c['related']),'참고 원문: '+' · '.join(f'[{data["sources"][s]["name"]}]({data["sources"][s]["url"]})' for s in c['sources'])])
        body.append('</section>');parts.extend(body)
        slug=f'{index:02d}_'+{'economics':'economics','finance':'finance','planning':'planning','law':'law'}[field['id']]
        text='\n\n'.join(markdown)+'\n'
        (ROOT/'content/chapters'/f'{slug}.md').write_text(text,encoding='utf-8')
        chapters.append({'slug':slug,'title':field['name'],'markdown':text,'html':'\n'.join(body)})
    glossary='# 용어사전\n\n'+'\n\n'.join(f'## {f["name"]}\n\n'+'\n\n'.join(c['title']+': '+c['summary'] for c in data['concepts'] if c['field']==f['id']) for f in data['fields'])
    (ROOT/'content/chapters/05_dictionary.md').write_text(glossary+'\n',encoding='utf-8')
    data['chapters']=chapters
    (dist/'content.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    (dist/'finance-guide-print.html').write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fieldbook · 리마인드 노트</title><link rel="stylesheet" href="styles.css"><body class="print-document"><header class="print-cover"><p>PERSONAL FINANCE FIELDBOOK · '+esc(data['edition'])+'</p><h1>다시 꺼내 보는<br>금융·경제 개념</h1><p>핵심 · 공식 · 예시 · 구분할 점</p><p>법·세제 카드는 개념과 판단 구조를 다룹니다. 구체적 한도·세율·기한은 적용 시점의 법령을 확인하세요.</p><button onclick="window.print()">인쇄 / PDF 저장</button></header>'+''.join(parts)+'</body></html>',encoding='utf-8')
    print(f'Built {len(ids)} concepts / {len(data["fields"])} fields → dist')

if __name__=='__main__':build()
