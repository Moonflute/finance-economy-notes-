let guideData = null;

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

const chapterMeta = {
  "01_economics": {
    label: "경제",
    kicker: "거시경제를 시장가격의 언어로 읽기",
    summary: "GDP, 물가, 고용, 금리, 환율, 정책 변수를 서로 연결해 경기 국면과 자산가격의 방향성을 설명하는 파트입니다.",
    points: ["AD-AS, IS-LM, 통화·재정정책을 한 흐름으로 연결", "금리와 환율 변화가 주식·채권·부동산에 미치는 경로 정리", "경기선행·동행·후행 지표를 구분해 해석"],
    map: ["국민소득", "물가·고용", "정책효과", "금리·환율", "경기순환"],
    tool: "economics",
  },
  "02_finance": {
    label: "금융",
    kicker: "상품 구조와 가치평가를 투자 의사결정으로 연결",
    summary: "주식, 채권, 파생상품, 대안투자, 부동산, 재무제표 분석을 수익 원천·위험 요인·평가모형 중심으로 재정리합니다.",
    points: ["주식은 현금흐름·성장률·할인율 중심으로 평가", "채권은 듀레이션·볼록성·신용스프레드로 위험 측정", "파생상품은 손익구조와 헤지 목적을 함께 해석"],
    map: ["금융상품", "주식", "채권", "파생상품", "포트폴리오", "부동산", "기업가치"],
    tool: "finance",
  },
  "03_planning": {
    label: "재무설계",
    kicker: "상품 추천이 아니라 목표와 제약의 설계",
    summary: "생애주기, 현금흐름, 자산·부채, 세금, 연금, 위험성향을 바탕으로 실행 가능한 재무계획을 구성합니다.",
    points: ["고객 정보 수집부터 사후관리까지 6단계 프로세스 정리", "세전수익률보다 세후 현금흐름 중심으로 판단", "은퇴·상속·증여는 장기 유동성과 가족관계를 함께 고려"],
    map: ["재무설계 프로세스", "현금흐름", "세금", "연금", "상속·증여"],
    tool: "planning",
  },
  "04_law": {
    label: "법률",
    kicker: "금융거래가 어떤 규칙 위에서 성립하는지 확인",
    summary: "민법·상법의 기본 권리관계와 금융소비자보호법, 자본시장법, 직무윤리를 실제 권유·거래 장면에 적용합니다.",
    points: ["투자자 분류에 따라 달라지는 판매규제 확인", "적합성·적정성·설명의무의 차이를 사례로 구분", "불공정거래와 이해상충 방지 장치를 연결"],
    map: ["민법", "상법", "은행거래", "금소법", "자본시장법", "직무윤리"],
    tool: "law",
  },
};

async function loadContent() {
  const response = await fetch("content.json");
  guideData = await response.json();
  renderAppVersion();
  renderNav();
  renderChapter(guideData.chapters[0].slug);
}

function renderAppVersion() {
  const versionNode = document.querySelector("#appVersion");
  if (versionNode) versionNode.textContent = `v ${guideData.version || "0.0.0"}`;
}

function renderNav() {
  const nav = document.querySelector("#chapterNav");
  nav.innerHTML = guideData.chapters
    .map((chapter, index) => `<button data-slug="${chapter.slug}" class="${index === 0 ? "active" : ""}">${displayTitle(chapter)}</button>`)
    .join("");
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-slug]");
    if (!button) return;
    nav.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderChapter(button.dataset.slug);
  });
}

function displayTitle(chapter) {
  if (chapter.slug === "05_dictionary") return "용어사전";
  return chapter.title;
}

function renderChapter(slug) {
  const chapter = guideData.chapters.find((item) => item.slug === slug);
  if (chapter.slug === "05_dictionary") {
    renderDictionaryChapter(chapter);
    return;
  }
  renderStudyChapter(chapter);
}

function renderStudyChapter(chapter) {
  const meta = chapterMeta[chapter.slug] || {};
  const sections = splitChapterSections(chapter.html);
  const host = document.querySelector("#chapterContent");
  host.innerHTML = `
    <section class="chapter-head">
      <p class="eyebrow">${escapeHtml(meta.kicker || "concept reference")}</p>
      <h2>${escapeHtml(meta.label || chapter.title)}</h2>
      <p>${escapeHtml(meta.summary || "원자료 기반 개념 레퍼런스입니다.")}</p>
    </section>
    <section class="section-block">
      <h3>개념 관계도</h3>
      ${renderConceptGraph(meta)}
    </section>
    ${renderTool(meta.tool)}
    <section class="subchapter-shell">
      <div class="subchapter-head">
        <h3>하위챕터</h3>
        <span>${sections.length} sections</span>
      </div>
      <div class="subchapter-tabs">${sections.map((section, index) => `<button class="${index === 0 ? "active" : ""}" data-section-index="${index}">${escapeHtml(section.title)}</button>`).join("")}</div>
      <article id="subchapterBody" class="subchapter-body"></article>
    </section>
  `;
  bindSectionExplorer(sections);
  bindChapterTools(meta.tool);
}

function splitChapterSections(html) {
  const cleaned = html.replace(/<h1>.*?<\/h1>/, "");
  const doc = document.createElement("div");
  doc.innerHTML = cleaned;
  const h4Count = doc.querySelectorAll("h4").length;
  const selector = h4Count > 2 ? "h4" : "h5";
  const headings = [...doc.querySelectorAll(selector)];
  if (headings.length === 0) return [{ title: "상세 정리", html: cleaned }];
  return headings.map((heading) => {
    const parts = [heading.outerHTML];
    let node = heading.nextElementSibling;
    while (node && !node.matches(selector)) {
      parts.push(node.outerHTML);
      node = node.nextElementSibling;
    }
    return { title: heading.textContent.trim(), html: parts.join("") };
  });
}

function bindSectionExplorer(sections) {
  const body = document.querySelector("#subchapterBody");
  const buttons = [...document.querySelectorAll(".subchapter-tabs button")];
  function paint(index) {
    buttons.forEach((button) => button.classList.toggle("active", Number(button.dataset.sectionIndex) === index));
    body.innerHTML = renderSectionBody(sections[index]);
  }
  buttons.forEach((button) => button.addEventListener("click", () => paint(Number(button.dataset.sectionIndex))));
  paint(0);
}


function renderSectionBody(section) {
  if (!section) return "";
  const doc = document.createElement("div");
  doc.innerHTML = section.html;
  const firstHeading = doc.querySelector("h4, h5");
  const firstLevel = firstHeading ? Number(firstHeading.tagName.slice(1)) : 4;
  const childSelector = firstLevel <= 4 ? "h5" : "h6";
  const childHeadings = [...doc.querySelectorAll(childSelector)];

  if (childHeadings.length < 2) {
    return `<div class="section-prose">${section.html}</div>`;
  }

  const introParts = [];
  let node = firstHeading ? firstHeading.nextElementSibling : doc.firstElementChild;
  while (node && !node.matches(childSelector)) {
    introParts.push(node.outerHTML);
    node = node.nextElementSibling;
  }

  const cards = childHeadings.map((heading, index) => {
    const parts = [];
    let child = heading.nextElementSibling;
    while (child && !child.matches(childSelector)) {
      parts.push(child.outerHTML);
      child = child.nextElementSibling;
    }
    return `
      <details class="concept-card" ${index === 0 ? "open" : ""}>
        <summary>${escapeHtml(heading.textContent.trim())}</summary>
        <div class="concept-card-body">${parts.join("")}</div>
      </details>
    `;
  }).join("");

  return `
    <div class="section-prose">
      ${firstHeading ? firstHeading.outerHTML : ""}
      ${introParts.join("")}
    </div>
    <div class="concept-card-grid">${cards}</div>
  `;
}
function renderConceptGraph(meta) {
  const nodes = meta.map || [];
  if (!nodes.length) return "";
  const center = escapeHtml(meta.label || "핵심");
  return `
    <div class="concept-graph" style="--node-count:${nodes.length}">
      <div class="graph-center">${center}</div>
      ${nodes.map((node, index) => `<div class="graph-node" style="--i:${index}"><span>${escapeHtml(node)}</span></div>`).join("")}
    </div>
  `;
}

function renderAside(meta, sections) {
  return `
    <h2>문서 구조</h2>
    <p>원자료를 개념 단위로 나눈 목차입니다. 필요한 항목만 펼쳐서 봅니다.</p>
    <div class="aside-section-list">${sections.slice(0, 12).map((section) => `<span>${escapeHtml(section.title)}</span>`).join("")}</div>
    <h2>검증 기준</h2>
    <p>세제·법률·시장제도는 공식 출처 기준으로 별도 검증해 반영합니다.</p>
    <div class="source-tags">
      <span>국세청</span><span>국가법령정보센터</span><span>금융위원회</span><span>금융감독원</span><span>한국거래소</span>
    </div>
  `;
}

function renderFrameworkBlock(html) {
  const doc = document.createElement("div");
  doc.innerHTML = html.replace(/<h1>.*?<\/h1>/, "");
  const heading = [...doc.querySelectorAll("h2")].find((node) => node.textContent.trim() === "개념 프레임");
  if (!heading) return "";
  const parts = [];
  let node = heading.nextElementSibling;
  while (node && !node.matches("h2, h3, h4")) {
    parts.push(node.outerHTML);
    node = node.nextElementSibling;
  }
  return `
    <section class="section-block framework-block">
      <h3>개념 프레임</h3>
      <div class="framework-body">${parts.join("")}</div>
    </section>
  `;
}
function renderTool(type) {
  if (type === "economics") return `
    <section class="tool-zone">
      <div class="tool-copy">
        <h3>금리·정책 전달경로</h3>
        <p>거시 변수 하나가 움직일 때 성장, 물가, 금리, 환율로 이어지는 일반적 전달 방향을 시각적으로 정리합니다.</p>
      </div>
      <div class="segmented" data-tool="macro">
        <button class="active" data-scenario="rateCut">금리 인하</button>
        <button data-scenario="rateHike">금리 인상</button>
        <button data-scenario="fiscalExpansion">재정 확대</button>
        <button data-scenario="oilShock">유가 충격</button>
      </div>
      <div id="macroScenario" class="scenario-grid"></div>
    </section>`;

  if (type === "finance") return `
    <section class="tool-zone two-col-tools">
      <article class="tool-panel">
        <h3>채권가격과 금리 민감도</h3>
        <div class="controls">
          <label>수정듀레이션 <input id="durationInput" type="range" min="1" max="12" step="0.1" value="5"></label>
          <label>볼록성 <input id="convexityInput" type="range" min="5" max="120" step="1" value="45"></label>
          <label>금리 변화(bp) <input id="bpInput" type="range" min="-200" max="200" step="5" value="50"></label>
        </div>
        <div class="result-line"><span>예상 가격 변화율</span><strong id="bondResult">-</strong></div>
        <canvas id="bondCanvas" width="620" height="240"></canvas>
      </article>
      <article class="tool-panel">
        <h3>CAPM 요구수익률 구조</h3>
        <div class="controls">
          <label>무위험수익률 <input id="rfInput" type="range" min="0" max="7" step="0.1" value="3.2"></label>
          <label>시장위험프리미엄 <input id="mrpInput" type="range" min="1" max="10" step="0.1" value="5"></label>
          <label>베타 <input id="betaInput" type="range" min="0.2" max="2" step="0.05" value="1"></label>
        </div>
        <div class="result-line"><span>기대수익률</span><strong id="capmResult">-</strong></div>
        <canvas id="capmCanvas" width="620" height="240"></canvas>
      </article>
    </section>`;

  if (type === "planning") return `
    <section class="tool-zone">
      <div class="tool-copy">
        <h3>은퇴 현금흐름 규모</h3>
        <p>월 생활비와 기간이 은퇴 필요자금 규모를 어떻게 바꾸는지 보여주는 보조 시각화입니다.</p>
      </div>
      <div class="planning-calc">
        <label>월 생활비(만원) <input id="monthlyNeed" type="range" min="100" max="800" step="10" value="300"></label>
        <label>은퇴기간(년) <input id="retireYears" type="range" min="10" max="45" step="1" value="30"></label>
        <div class="result-line"><span>단순 필요자금</span><strong id="retireResult">-</strong></div>
      </div>
    </section>`;

  if (type === "law") return `
    <section class="tool-zone">
      <div class="tool-copy">
        <h3>금융상품 판매규제 구조</h3>
        <p>일반투자자 보호 장치가 판매 과정의 어느 지점에 배치되는지 정리한 구조입니다.</p>
      </div>
      <div class="checklist">
        <label><input type="checkbox"> 투자목적·재산상황·경험 확인</label>
        <label><input type="checkbox"> 상품 위험등급과 투자자 성향 비교</label>
        <label><input type="checkbox"> 원금손실 가능성·수수료·환매제한 설명</label>
        <label><input type="checkbox"> 부당권유·단정적 판단 제공 금지</label>
        <label><input type="checkbox"> 설명 확인 자료 보존</label>
      </div>
    </section>`;
  return "";
}

function bindChapterTools(type) {
  if (type === "economics") bindMacroTool();
  if (type === "finance") bindFinanceTools();
  if (type === "planning") bindPlanningTool();
}

function bindMacroTool() {
  const scenarios = {
    rateCut: { title: "금리 인하", items: [["성장", "상승 압력"], ["물가", "상승 압력"], ["시장금리", "하락"], ["환율", "상승 압력"]] },
    rateHike: { title: "금리 인상", items: [["성장", "둔화 압력"], ["물가", "하락 압력"], ["채권가격", "하락"], ["환율", "하락 압력"]] },
    fiscalExpansion: { title: "재정 확대", items: [["성장", "상승 압력"], ["물가", "상승 압력"], ["국채금리", "상승 압력"], ["민간투자", "구축 가능"]] },
    oilShock: { title: "유가 충격", items: [["성장", "둔화 압력"], ["물가", "상승 압력"], ["기업마진", "압박"], ["정책판단", "복잡화"]] },
  };
  const host = document.querySelector("#macroScenario");
  const buttons = document.querySelectorAll("[data-tool='macro'] button");
  function paint(key) {
    const scenario = scenarios[key];
    host.innerHTML = scenario.items.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("");
  }
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    paint(button.dataset.scenario);
  }));
  paint("rateCut");
}

function bindFinanceTools() {
  ["durationInput", "convexityInput", "bpInput"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", updateBondTool));
  ["rfInput", "mrpInput", "betaInput"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", updateCapmTool));
  updateBondTool();
  updateCapmTool();
}

function bindPlanningTool() {
  ["monthlyNeed", "retireYears"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", updatePlanningTool));
  updatePlanningTool();
}

function updatePlanningTool() {
  const monthly = Number(document.querySelector("#monthlyNeed").value);
  const years = Number(document.querySelector("#retireYears").value);
  const total = monthly * 12 * years;
  document.querySelector("#retireResult").textContent = `${money.format(total)}만원`;
}

function renderDictionaryChapter(chapter) {
  const entries = getDictionaryEntries(chapter.markdown);
  const host = document.querySelector("#chapterContent");
  host.innerHTML = `
    <section class="chapter-head">
      <p class="eyebrow">dictionary</p>
      <h2>용어사전</h2>
      <p>중요 개념을 한 줄 단위로 빠르게 리마인드하는 섹션입니다.</p>
    </section>
    <div class="dictionary-search" role="search">
      <label for="dictionarySearch">용어 검색</label>
      <input id="dictionarySearch" type="search" placeholder="GDP, 듀레이션, 적합성 원칙..." autocomplete="off">
      <span id="dictionaryCount">${entries.length} terms</span>
    </div>
    <div id="dictionaryResults" class="dictionary-results"></div>`;
  const input = host.querySelector("#dictionarySearch");
  const results = host.querySelector("#dictionaryResults");
  const count = host.querySelector("#dictionaryCount");
  function paint() {
    const query = input.value.trim().toLowerCase();
    const filtered = entries.filter((entry) => `${entry.category} ${entry.term} ${entry.definition}`.toLowerCase().includes(query));
    count.textContent = `${filtered.length} / ${entries.length} terms`;
    results.innerHTML = renderDictionaryResults(filtered, query);
  }
  input.addEventListener("input", paint);
  paint();
}

function getDictionaryEntries(markdown) {
  const entries = [];
  let category = "기타";
  markdown.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.startsWith("## ")) category = line.replace(/^##\s+/, "");
    if (!line || line.startsWith("#") || !line.includes(" : ")) return;
    const [term, ...definitionParts] = line.split(" : ");
    entries.push({ category, term: term.trim(), definition: definitionParts.join(" : ").trim() });
  });
  return entries;
}

function renderDictionaryResults(entries, query) {
  if (entries.length === 0) return `<p class="dictionary-empty">검색 결과가 없습니다.</p>`;
  const grouped = new Map();
  entries.forEach((entry) => {
    if (!grouped.has(entry.category)) grouped.set(entry.category, []);
    grouped.get(entry.category).push(entry);
  });
  return [...grouped.entries()].map(([category, categoryEntries]) => `
    <section class="dictionary-group">
      <h3>${escapeHtml(category)}</h3>
      <dl>${categoryEntries.map((entry) => `<div class="dictionary-entry"><dt>${highlightTerm(entry.term, query)}</dt><dd>${highlightTerm(entry.definition, query)}</dd></div>`).join("")}</dl>
    </section>`).join("");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function highlightTerm(value, query) {
  const escaped = escapeHtml(value);
  if (!query) return escaped;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(safeQuery, "gi"), (match) => `<mark>${match}</mark>`);
}

function pct(value) {
  return `${money.format(value)}%`;
}

function updateBondTool() {
  const duration = Number(document.querySelector("#durationInput").value);
  const convexity = Number(document.querySelector("#convexityInput").value);
  const bp = Number(document.querySelector("#bpInput").value);
  const dy = bp / 10000;
  const change = (-duration * dy + 0.5 * convexity * dy * dy) * 100;
  document.querySelector("#bondResult").textContent = pct(change);
  drawBondChart(duration, convexity);
}

function updateCapmTool() {
  const rf = Number(document.querySelector("#rfInput").value);
  const mrp = Number(document.querySelector("#mrpInput").value);
  const beta = Number(document.querySelector("#betaInput").value);
  const expected = rf + beta * mrp;
  document.querySelector("#capmResult").textContent = pct(expected);
  drawCapmChart(rf, mrp, beta);
}

function prepCanvas(id) {
  const canvas = document.querySelector(`#${id}`);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#d8dee8";
  ctx.lineWidth = 1;
  for (let x = 50; x < width - 20; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, height - 35);
    ctx.stroke();
  }
  for (let y = 30; y < height - 30; y += 45) {
    ctx.beginPath();
    ctx.moveTo(45, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#2b3440";
  ctx.beginPath();
  ctx.moveTo(45, 20);
  ctx.lineTo(45, height - 35);
  ctx.lineTo(width - 20, height - 35);
  ctx.stroke();
  return { ctx, width, height };
}

function drawBondChart(duration, convexity) {
  const { ctx, width, height } = prepCanvas("bondCanvas");
  const points = [];
  for (let bp = -200; bp <= 200; bp += 10) {
    const dy = bp / 10000;
    points.push({ x: bp, value: (-duration * dy + 0.5 * convexity * dy * dy) * 100 });
  }
  drawLine(ctx, points, width, height, "#116a7b", -12, 12, "bp", "%");
}

function drawCapmChart(rf, mrp, beta) {
  const { ctx, width, height } = prepCanvas("capmCanvas");
  const maxY = Math.max(16, rf + 2 * mrp);
  const points = [];
  for (let b = 0; b <= 2; b += 0.05) points.push({ x: b, value: rf + b * mrp });
  drawLine(ctx, points, width, height, "#8f4f24", 0, maxY, "β", "%");
  const x = 45 + (beta / 2) * (width - 65);
  const y = height - 35 - ((rf + beta * mrp) / maxY) * (height - 55);
  ctx.fillStyle = "#d1495b";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLine(ctx, points, width, height, color, minY, maxY, xLabel, yLabel) {
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const plotX = (x) => 45 + ((x - minX) / (maxX - minX)) * (width - 65);
  const plotY = (y) => height - 35 - ((y - minY) / (maxY - minY)) * (height - 55);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = plotX(point.x);
    const y = plotY(point.value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = "#45505f";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(xLabel, width - 38, height - 12);
  ctx.fillText(yLabel, 14, 24);
}

loadContent();





