// Build the repository reference from the same metadata the app displays.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'site',name),'utf8');
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
(async()=>{
  const engineUrl=dataUrl(read('simulation-engine.js')),controlsUrl=dataUrl(read('simulation-controls.js'));
  const engine=await import(engineUrl);
  const help=await import(dataUrl(read('simulation-help.js').replace("'./simulation-engine.js'",JSON.stringify(engineUrl)).replace("'./simulation-controls.js'",JSON.stringify(controlsUrl))));
  assert.deepEqual(Object.keys(help.PARTICIPANT_HELP).sort(),engine.PARTICIPANT_ATTRIBUTES.map(field=>field.key).sort(),'Every editable participant attribute needs help.');
  const ids=new Set();let pages=0;
  for(const section of help.HELP_SECTIONS)for(const entry of section.topics){
    assert(!ids.has(entry.key),`Duplicate help topic: ${entry.key}`);ids.add(entry.key);
    assert(entry.pages.length && entry.pages.every(page=>typeof page==='string' && page.trim() && !/undefined|NaN/.test(page)),`Incomplete help: ${entry.key}`);
    assert(!entry.facts || !/undefined|NaN/.test(entry.facts),`Invalid range: ${entry.key}`);
    pages+=entry.pages.length;
  }
  const lines=['# 증권시장 시뮬레이션 · 속성 및 상호작용','이 문서는 현재 구현한 모형을 설명합니다. 앱의 열 제목 설명과 ‘속성·규칙’ 안내는 같은 `site/simulation-help.js`를 사용합니다. 범위·누락값은 엔진의 속성 정의에서 가져옵니다.','열 제목에 마우스를 올리거나 키보드로 초점을 옮기면 설명이 열립니다. 클릭·터치는 설명을 고정하며, 다시 클릭하거나 다른 곳·Escape를 누르면 닫힙니다. 인원 배정의 속성 안내는 해당 항목의 자세한 안내로 이동합니다.','## 참여자 속성 목록','| 속성 | 코드 키 | 범위·누락값 | 의미 |','| --- | --- | --- | --- |'];
  for(const field of engine.PARTICIPANT_ATTRIBUTES){const item=help.participantHelp(field.key);lines.push(`| ${item.label} | \`${item.key}\` | ${item.facts} | ${item.summary} |`);}
  for(const section of help.HELP_SECTIONS){
    lines.push('## '+section.label);
    for(const entry of section.topics)lines.push('### '+entry.label,...(entry.facts?[entry.facts]:[]),...entry.pages);
  }
  lines.push('## 설명 갱신 방법','참여자 속성을 추가할 때 `PARTICIPANT_ATTRIBUTES`와 `PARTICIPANT_HELP`를 함께 갱신합니다. 판단 순서·체결·뉴스·거래량·감정 등 동작을 바꾸면 해당 `HELP_SECTIONS` 항목도 수정합니다.','`node scripts/build-simulation-reference.cjs`로 이 문서를 갱신합니다. `--check`는 누락·중복 설명과 문서의 최신 여부만 확인하며 매매 실험을 실행하지 않습니다.');
  const output=lines.join('\n\n').replace(/\|\n\n\|/g,'|\n|')+'\n',file=path.join(root,'docs','simulation-reference.md');
  if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),output,'Run node scripts/build-simulation-reference.cjs to update the reference.');
  else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output);}
  console.log(`${process.argv.includes('--check')?'Checked':'Generated'} ${engine.PARTICIPANT_ATTRIBUTES.length} participant attributes / ${ids.size} topics / ${pages} explanation pages.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
