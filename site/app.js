import {LABS, labMarkup, mountLab} from './labs.js';
import {marketMarkup, mountMarkets} from './markets.js';
import {simulationMarkup, mountSimulation} from './simulation.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const narrow = matchMedia('(max-width:960px)');
const storageKey = 'fieldbook-personal-v1';
let data, byId, route = 'home', sub = '', cleanup = null;
let filterGroup = '전체', libraryQuery = '', toastTimer;
let stored = {}, bookmarks = [];
try {
  const value = JSON.parse(localStorage.getItem(storageKey));
  if (value && typeof value === 'object' && !Array.isArray(value)) stored = value;
  if (Array.isArray(stored.bookmarks)) bookmarks = stored.bookmarks.filter(x => typeof x === 'string');
} catch {}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2000);
}
function saveBookmarks() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({...stored, bookmarks}));
    return true;
  } catch { return false; }
}
function syncMenu() {
  const open = document.body.classList.contains('menu-open');
  $('#sidebar').inert = narrow.matches && !open;
  const toggle = $('[data-menu]');
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}
function closeMenu() { document.body.classList.remove('menu-open'); syncMenu(); }
narrow.addEventListener('change', syncMenu);
const field = id => data.fields.find(f => f.id === id);
const link = (id, label) => `<a href="#concept/${id}">${escape(label || byId.get(id)?.title)}</a>`;
const tag = c => `<span class="field-tag" style="--field:${field(c.field).color}"><i></i>${field(c.field).name}</span>`;
function bookmarkButton(c, compact = false) {
  const selected = bookmarks.includes(c.id);
  return `<button class="${compact ? 'bookmark-button' : 'button secondary'} ${selected ? 'selected' : ''}" data-bookmark="${c.id}" aria-label="${escape(c.title)} 북마크" aria-pressed="${selected}">${compact ? (selected ? '★' : '☆') : (selected ? '★ 북마크됨' : '☆ 북마크')}</button>`;
}
function card(c) {
  return `<article class="concept-card" style="--field:${field(c.field).color}"><div class="card-top">${tag(c)}${bookmarkButton(c, true)}</div><a href="#concept/${c.id}" class="card-main"><span class="card-en">${escape(c.en)}</span><h3>${escape(c.title)}</h3><p>${escape(c.summary)}</p></a><div class="card-bottom"><span>${escape(c.group)}</span><span aria-hidden="true">↗</span></div></article>`;
}
function pageHead(title, description = '', extra = '') {
  return `<header class="page-heading"><div><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div>${extra}</header>`;
}
function navigate() {
  const previous = route, parts = location.hash.replace(/^#\/?/, '').split('/');
  route = parts[0] || 'home';
  try { sub = decodeURIComponent(parts.slice(1).join('/')); } catch { sub = ''; }
  const aliases = {'01_economics':'economics','02_finance':'finance','03_planning':'planning','04_law':'law'};
  if (aliases[route]) { location.replace('#library/' + aliases[route]); return; }
  if (['dictionary','review','links','map'].includes(route)) { location.replace('#library'); return; }
  if (cleanup) { cleanup(); cleanup = null; }
  if (previous !== route) { filterGroup = '전체'; libraryQuery = ''; }
  if (!['home','library','concept','bookmarks','lab','markets','simulation'].includes(route)) { route = 'home'; sub = ''; }
  document.body.classList.toggle('simulation-layout',route === 'simulation');
  shell();
  ({home, library, bookmarks:library, concept, lab:labPage, markets:marketPage, simulation:simulationPage})[route]();
  const title = route === 'concept' && byId.has(sub) ? byId.get(sub).title : {home:'금융·경제 노트', library:'개념 사전', bookmarks:'북마크', lab:'실험실', markets:'시장 데이터', simulation:'증권시장 시뮬레이션', concept:'개념'}[route];
  document.title = title + ' · Money';
  window.scrollTo({top:0, behavior:'instant'});
  $('#main').focus({preventScroll:true});
  closeMenu();
}
function shell() {
  const nav = [['home','분야'],['library','개념 사전'],['bookmarks','북마크'],['lab','실험실'],['markets','시장 데이터'],['simulation','시장 시뮬레이션']];
  const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',library:'<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M6 8h1m10 0h1M6 12h1m10 0h1"/>',bookmarks:'<path d="M6 3h12v18l-6-4-6 4z"/>',lab:'<path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M7 15h10"/>',markets:'<path d="M3 3v18h18M6 15l5-5 4 3 6-8"/>',simulation:'<path d="M5 3v18m7-18v18m7-18v18"/><rect x="3" y="7" width="4" height="7" fill="currentColor" stroke="none"/><rect x="10" y="5" width="4" height="11" fill="currentColor" stroke="none"/><rect x="17" y="10" width="4" height="8" fill="currentColor" stroke="none"/>'};
  const icon=id=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[id]}</svg>`;
  $('#sidebar').innerHTML = `<a href="#home" class="brand"><span class="brand-icon" aria-hidden="true">${icon('markets')}</span><div>fieldbook<span>금융·경제 노트</span></div></a><nav>${nav.map(([id,label]) => `<a href="#${id}" ${route === id ? 'aria-current="page"' : ''} class="nav-item ${route === id ? 'active' : ''}"><span class="nav-icon" aria-hidden="true">${icon(id)}</span>${label}</a>`).join('')}</nav><div class="sidebar-label field-label">분야별 노트</div><nav class="field-navigation">${data.fields.map(f => `<a href="#library/${f.id}" ${route === 'library' && sub === f.id ? 'aria-current="page"' : ''}><i style="background:${f.color}"></i>${f.name}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="finance-guide-print.html" target="_blank" rel="noreferrer">전체 내용 인쇄 ↗</a></div>`;
  const label = nav.find(([id]) => id === route)?.[1] || '개념';
  $('#topbar').innerHTML = `<button class="icon-button menu-button" data-menu aria-label="메뉴 열기" aria-expanded="false">☰</button><div class="breadcrumb"><a href="#home">Fieldbook</a><span>/</span><b>${label}</b></div><button class="search-trigger" data-open-search><span aria-hidden="true">⌕</span><span>개념 검색</span><kbd>Ctrl K</kbd></button><a class="print-button" href="finance-guide-print.html" target="_blank" rel="noreferrer">인쇄 ↗</a>`;
  $('#footer').innerHTML = `<span>FIELDBOOK <b>·</b> ${data.edition}</span><span>경제 · 금융 · 재무설계 · 법률</span>`;
}
function home() {
  $('#main').innerHTML = `<div class="subject-home">${pageHead('금융·경제 노트')}<div class="collection-grid">${data.fields.map(f => `<a href="#library/${f.id}" class="collection-tile" style="--field:${f.color}"><div><span class="collection-no">${f.icon}</span><span class="collection-arrow" aria-hidden="true">↗</span></div><span class="collection-en">${f.en}</span><h2>${f.name}</h2><p>${f.description}</p></a>`).join('')}</div></div>`;
}
function library() {
  const isSaved = route === 'bookmarks';
  const selected = data.fields.some(f => f.id === sub) ? sub : 'all';
  const heading = isSaved ? '북마크' : selected === 'all' ? '개념 사전' : field(selected).name;
  $('#main').innerHTML = pageHead(heading) + `<div class="library-toolbar"><div class="field-tabs" role="group" aria-label="분야 필터"><a href="#${isSaved ? 'bookmarks' : 'library'}" class="${selected === 'all' ? 'active' : ''}">전체</a>${data.fields.map(f => `<a href="#${isSaved ? 'bookmarks' : 'library'}/${f.id}" class="${selected === f.id ? 'active' : ''}">${f.name}</a>`).join('')}</div><div class="library-search"><span aria-hidden="true">⌕</span><label class="sr-only" for="librarySearch">개념 검색</label><input id="librarySearch" placeholder="제목 또는 본문 검색" value="${escape(libraryQuery)}"></div></div><div class="library-layout"><aside class="group-filter"><h2>주제</h2><div id="groupButtons"></div></aside><div class="library-content"><div class="result-meta"><strong id="resultCount"></strong></div><div id="conceptGrid" class="concept-grid"></div></div></div>`;
  const pool = data.concepts.filter(c => (selected === 'all' || c.field === selected) && (!isSaved || bookmarks.includes(c.id)));
  const groups = ['전체', ...new Set(pool.map(c => c.group))];
  if (!groups.includes(filterGroup)) filterGroup = '전체';
  const paintGroups = () => { $('#groupButtons').innerHTML = groups.map(g => `<button data-group="${escape(g)}" class="${filterGroup === g ? 'active' : ''}" aria-pressed="${filterGroup === g}">${escape(g)}<small>${g === '전체' ? pool.length : pool.filter(c => c.group === g).length}</small></button>`).join(''); };
  const paint = () => {
    const rows = pool.filter(c => (filterGroup === '전체' || c.group === filterGroup) && matches(c, libraryQuery.trim().toLowerCase()));
    $('#resultCount').textContent = rows.length + '개 항목';
    $('#conceptGrid').innerHTML = rows.length ? rows.map(card).join('') : `<div class="empty-state"><h3>${isSaved && !pool.length ? '저장한 북마크가 없습니다.' : '검색 결과가 없습니다.'}</h3><a href="#library" class="button secondary">개념 사전</a></div>`;
  };
  $('#librarySearch').addEventListener('input', e => { libraryQuery = e.target.value; paint(); });
  $('#groupButtons').addEventListener('click', e => { const b = e.target.closest('[data-group]'); if (b) { filterGroup = b.dataset.group; paintGroups(); paint(); } });
  paintGroups(); paint();
}
function matches(c, q) {
  return !q || [c.title,c.en,c.group,c.summary,c.formula,...(c.body || [])].join(' ').toLowerCase().includes(q);
}
function concept() {
  const c = byId.get(sub);
  if (!c) { $('#main').innerHTML = pageHead('개념을 찾지 못했습니다.', '', '<a href="#library" class="button secondary">개념 사전</a>'); return; }
  const f = field(c.field), group = data.concepts.filter(x => x.field === c.field && x.group === c.group), index = group.findIndex(x => x.id === c.id);
  const prev = group[index - 1], next = group[index + 1];
  const paragraphs = c.body || [c.summary, c.detail, c.example, c.trap];
  const lab = c.lab && LABS.find(l => l.id === c.lab);
  $('#main').innerHTML = `<div class="reading-page"><div class="detail-breadcrumb"><a href="#library/${f.id}">${f.name}</a><span>/</span>${escape(c.group)}</div><header class="concept-heading"><div><p class="detail-en">${escape(c.en)}</p><h1>${escape(c.title)}</h1></div>${bookmarkButton(c)}</header><article class="concept-article"><div class="prose">${paragraphs.map((p,i) => `<p>${escape(p)}</p>${i === 1 ? `<div class="article-formula"><span>식 · 구조</span><div class="formula">${escape(c.formula)}</div></div>` : ''}`).join('')}</div>${lab ? `<div class="article-tool"><span>관련 계산</span><a href="#lab/${lab.id}">${escape(lab.name)} ↗</a></div>` : ''}<footer class="article-references"><div class="reference-links"><h2>관련 개념</h2><div>${c.related.map(id => link(id)).join('')}</div></div><div class="source-panel"><h2>참고 자료</h2>${c.regulatory ? '<p>제도의 적용 대상·한도·세율·기한은 해당 시점의 법령과 공식 안내를 기준으로 합니다.</p>' : ''}<div>${c.sources.map(id => `<a href="${escape(data.sources[id].url)}" target="_blank" rel="noreferrer">${escape(data.sources[id].name)} ↗</a>`).join('')}</div></div></footer></article><nav class="concept-pager" aria-label="같은 주제 항목">${prev ? link(prev.id, '← ' + prev.title) : '<span></span>'}${next ? link(next.id, next.title + ' →') : ''}</nav></div>`;
}
function labPage() {
  const lab = LABS.find(x => x.id === sub);
  if (!lab) {
    $('#main').innerHTML = pageHead('실험실') + `<div class="lab-grid">${LABS.map((x,i) => `<a class="lab-tile" href="#lab/${x.id}" style="--field:${x.color}"><div><span class="lab-number">0${i+1}</span><span aria-hidden="true">↗</span></div><h2>${x.name}</h2><p>${x.description}</p><div class="mini-wave" aria-hidden="true">${[25,42,34,58,45,68,60,82,72,94].map((h,j) => `<i style="height:${h}%;--delay:${j*80}ms"></i>`).join('')}</div></a>`).join('')}</div>`;
    return;
  }
  $('#main').innerHTML = `<a href="#lab" class="back-link">← 실험실</a>` + pageHead(lab.name, lab.description) + `<section id="activeLab">${labMarkup(lab.id)}</section><div class="reference-links lab-references"><h2>관련 개념</h2><div>${lab.concepts.map(id => link(id)).join('')}</div></div>`;
  mountLab($('#activeLab'), lab.id);
}
function marketPage() {
  $('#main').innerHTML = pageHead('시장 데이터') + marketMarkup();
  cleanup = mountMarkets($('#marketRoot'));
}
function simulationPage() {
  $('#main').innerHTML = simulationMarkup();
  cleanup = mountSimulation($('#simulationRoot'));
}
function globalSearch(q) {
  const query = q.trim().toLowerCase();
  if (!query) { $('#searchResults').innerHTML = '<p class="empty-search">제목이나 본문의 단어로 검색합니다.</p>'; return; }
  const rows = data.concepts.filter(c => matches(c, query)).slice(0,30);
  $('#searchResults').innerHTML = rows.length ? rows.map(c => `<a href="#concept/${c.id}" data-search-result><div>${tag(c)}<b>${escape(c.title)}</b><p>${escape(c.summary)}</p></div><span aria-hidden="true">↗</span></a>`).join('') : '<p class="empty-search">검색 결과가 없습니다.</p>';
}
function openSearch() { $('#searchDialog').showModal(); $('#globalSearch').value = ''; globalSearch(''); $('#globalSearch').focus(); }
document.addEventListener('click', e => {
  if (e.target.closest('[data-open-search]')) openSearch();
  if (e.target.closest('[data-close-search],[data-search-result]')) $('#searchDialog').close();
  if (e.target.closest('[data-menu]')) { document.body.classList.toggle('menu-open'); syncMenu(); }
  if (e.target.closest('#sidebar a[href^="#"]')) closeMenu();
  if (document.body.classList.contains('menu-open') && !e.target.closest('#sidebar,[data-menu]')) closeMenu();
  const b = e.target.closest('[data-bookmark]');
  if (b) {
    const id = b.dataset.bookmark, had = bookmarks.includes(id);
    bookmarks = had ? bookmarks.filter(x => x !== id) : [...bookmarks,id];
    const persisted = saveBookmarks();
    document.querySelectorAll(`[data-bookmark="${id}"]`).forEach(x => {
      x.classList.toggle('selected', !had); x.setAttribute('aria-pressed', String(!had));
      x.textContent = x.classList.contains('bookmark-button') ? (had ? '☆' : '★') : (had ? '☆ 북마크' : '★ 북마크됨');
    });
    toast(persisted ? (had ? '북마크 해제' : '북마크 저장') : '브라우저 저장이 제한되어 현재 화면에서만 유지됩니다.');
    if (route === 'bookmarks') library();
  }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && data) { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') closeMenu();
});
$('#globalSearch').addEventListener('input', e => globalSearch(e.target.value));
$('#searchDialog').addEventListener('click', e => {
  if (e.target !== $('#searchDialog')) return;
  const r = e.target.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
});
window.addEventListener('hashchange', navigate);
async function boot() {
  try {
    const response = await fetch('content.json');
    if (!response.ok) throw Error('HTTP ' + response.status);
    data = await response.json(); byId = new Map(data.concepts.map(c => [c.id,c]));
    bookmarks = [...new Set(bookmarks)].filter(id => byId.has(id));
    navigate();
  } catch (e) {
    $('#main').innerHTML = '<div class="empty-state"><h1>내용을 불러오지 못했습니다.</h1><p>연결을 확인한 뒤 다시 시도해주세요.</p><button class="button primary" id="retryBoot">다시 시도</button><a href="finance-guide-print.html">인쇄용 문서</a></div>';
    $('#retryBoot').onclick = boot; console.error(e);
  }
}
boot();
