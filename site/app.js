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
  renderChapter(guideData.chapters[0].slug);
}

function renderAppVersion() {
  const versionNode = document.querySelector("#appVersion");
  if (versionNode) versionNode.textContent = `v ${guideData.version || "0.0.0"}`;
}

function renderNav(activeSlug) {
  const nav = document.querySelector("#chapterNav");
  nav.innerHTML = guideData.chapters.map((chapter, index) => {
    const active = chapter.slug === activeSlug;
    const outline = active && chapter.slug !== "05_dictionary" ? getChapterOutline(chapter.html) : [];
    return `
      <div class="nav-group">
        <button data-slug="${chapter.slug}" class="chapter-nav ${active ? "active" : ""}">${displayTitle(chapter)}</button>
        ${outline.length ? `<div class="subnav">${outline.map((item) => `<button class="subnav-item level-${item.level}" data-anchor="${item.id}">${escapeHtml(item.title)}</button>`).join("")}</div>` : ""}
      </div>
    `;
  }).join("");
  nav.onclick = (event) => {
    const chapterButton = event.target.closest("button[data-slug]");
    if (chapterButton) {
      renderChapter(chapterButton.dataset.slug);
      return;
    }
    const sectionButton = event.target.closest("button[data-anchor]");
    if (sectionButton) {
      document.getElementById(sectionButton.dataset.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
}

function displayTitle(chapter) {
  if (chapter.slug === "05_dictionary") return "용어사전";
  return chapter.title;
}

function renderChapter(slug) {
  const chapter = guideData.chapters.find((item) => item.slug === slug);
  renderNav(slug);
  if (chapter.slug === "05_dictionary") {
    renderDictionaryChapter(chapter);
    return;
  }
  renderStudyChapter(chapter);
}

function renderStudyChapter(chapter) {
  const meta = chapterMeta[chapter.slug] || {};
  const prepared = prepareChapterHtml(chapter.html, meta.tool);
  const host = document.querySelector("#chapterContent");
  host.innerHTML = `
    <section class="chapter-head">
      <p class="eyebrow">${escapeHtml(meta.kicker || "concept reference")}</p>
      <h2>${escapeHtml(meta.label || chapter.title)}</h2>
      <p>${escapeHtml(meta.summary || "원자료 기반 개념 레퍼런스입니다.")}</p>
    </section>
    <section class="main-body">${prepared.html}</section>
  `;
  bindChapterTools(meta.tool);
}

function getChapterOutline(html) {
  const doc = document.createElement("div");
  doc.innerHTML = html.replace(/<h1>.*?<\/h1>/, "");
  return [...doc.querySelectorAll("h4, h5")].map((heading, index) => ({
    id: makeHeadingId(heading.textContent, index),
    title: heading.textContent.trim(),
    level: heading.tagName === "H4" ? 1 : 2,
  }));
}

function prepareChapterHtml(html, toolType) {
  const doc = document.createElement("div");
  doc.innerHTML = html.replace(/<h1>.*?<\/h1>/, "");
  [...doc.querySelectorAll("h4, h5")].forEach((heading, index) => {
    heading.id = makeHeadingId(heading.textContent, index);
  });
  insertInlineTool(doc, toolType);
  return { html: doc.innerHTML };
}

function makeHeadingId(text, index) {
  return `section-${index}-${String(text).trim().replace(/[^0-9A-Za-z?-?]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
}


function insertInlineTool(doc, toolType) {
  collapseSummaryBlock(doc);
  if (toolType === "economics") insertEconomicsVisuals(doc);
  if (toolType === "finance") insertFinanceVisuals(doc);
  if (toolType === "planning") insertPlanningVisuals(doc);
  if (toolType === "law") insertLawVisuals(doc);
}

function collapseSummaryBlock(doc) {
  const heading = [...doc.querySelectorAll("h2")].find((node) => ["심화 정리", "요약"].includes(node.textContent.trim()));
  if (!heading) return;
  const parts = [];
  let node = heading.nextElementSibling;
  while (node && !node.matches("h2, h4")) {
    const next = node.nextElementSibling;
    parts.push(node.outerHTML);
    node.remove();
    node = next;
  }
  const details = document.createElement("details");
  details.className = "summary-toggle";
  details.innerHTML = `<summary>요약</summary><div class="summary-body">${parts.join("")}</div>`;
  heading.replaceWith(details);
}

function insertAfterHeading(doc, keywords, html, levelSelector = "h4, h5") {
  const headings = [...doc.querySelectorAll(levelSelector)];
  const target = headings.find((heading) => keywords.some((keyword) => heading.textContent.includes(keyword)));
  if (!target) return false;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  target.insertAdjacentElement("afterend", wrapper.firstElementChild);
  return true;
}

function insertAtTop(doc, html) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  doc.insertBefore(wrapper.firstElementChild, doc.firstElementChild);
}

function insertEconomicsVisuals(doc) {
  insertAfterHeading(doc, ["거시경제의 시계", "시장/주체"], renderMacroSystemVisual());
  insertAfterHeading(doc, ["생산물/노동/인플레이션", "생산물 시장"], renderAdAsVisual());
  insertAfterHeading(doc, ["재정 및 통화정책", "통화 정책"], renderPolicyVisual());
  insertAfterHeading(doc, ["이자율 및 환율", "이자율"], renderYieldFxVisual());
  insertAfterHeading(doc, ["화폐의 수요", "화폐"], renderMoneyAggregateVisual());
}

function insertFinanceVisuals(doc) {
  insertAtTop(doc, renderAssetUniverseVisual());
  insertAfterHeading(doc, ["채권 투자", "채권"], renderBondVisual());
  insertAfterHeading(doc, ["재무제표 분석", "재무제표"], renderStatementVisual());
  insertAfterHeading(doc, ["주식 투자", "주식"], renderMarketIndexVisual());
}

function insertPlanningVisuals(doc) {
  insertAfterHeading(doc, ["세무 전략", "조세"], renderTaxVisual());
  insertAfterHeading(doc, ["개인 재무설계", "재무설계"], renderPlanningProcessVisual());
}

function insertLawVisuals(doc) {
  insertAfterHeading(doc, ["금융소비자 보호법", "금융소비자"], renderSalesRuleVisual());
}

function renderMacroSystemVisual() {
  return `
    <section class="visual-block macro-system">
      <div class="visual-head"><span>도식</span><h3>거시경제의 4대 시장과 5대 주체</h3></div>
      <div class="market-agent-grid">
        <div class="market-card"><strong>생산물시장</strong><span>실질 GDP · 물가</span></div>
        <div class="market-card"><strong>노동시장</strong><span>고용량 · 실질임금</span></div>
        <div class="market-card"><strong>대부자금시장</strong><span>실질이자율 · 자금거래량</span></div>
        <div class="market-card"><strong>외환시장</strong><span>환율 · 외환거래량</span></div>
      </div>
      <div class="agent-row"><span>가계</span><span>기업</span><span>정부</span><span>해외</span><span>중앙은행</span></div>
      <div class="formula-board">
        <div><b>지출 GDP</b><code>Y = C + I + G + (X - M)</code></div>
        <div><b>대외균형</b><code>X - M = (T - G) + (S - I)</code></div>
        <div><b>해석</b><p>경상수지는 국내 총저축과 국내투자의 차이로 읽는다.</p></div>
      </div>
      <div class="venn-row">
        <div class="venn-card"><b>GDP</b><span>국내에서 생산된 최종재·서비스</span></div>
        <div class="venn-card"><b>GNP</b><span>GDP + 국외순수취요소소득</span></div>
        <div class="venn-card"><b>GNI</b><span>GNP에 교역조건 효과를 반영한 국민소득</span></div>
      </div>
    </section>`;
}

function renderAdAsVisual() {
  return `
    <section class="visual-block interactive-visual" data-visual="adas">
      <div class="visual-head"><span>그래프</span><h3>AD-AS와 노동·필립스 곡선</h3></div>
      <div class="segmented compact" data-tool="adas">
        <button class="active" data-shock="demandUp">총수요 증가</button>
        <button data-shock="supplyDown">총공급 감소</button>
        <button data-shock="laborDemand">노동수요 증가</button>
        <button data-shock="phillips">단기 필립스</button>
      </div>
      <canvas id="adasCanvas" width="760" height="320"></canvas>
      <div id="adasNotes" class="visual-notes"></div>
    </section>`;
}

function renderPolicyVisual() {
  return `
    <section class="visual-block policy-flow" data-visual="policy">
      <div class="visual-head"><span>전달경로</span><h3>재정·통화정책 파급경로</h3></div>
      <div class="segmented compact" data-tool="policy">
        <button class="active" data-policy="moneyEase">확장적 통화정책</button>
        <button data-policy="moneyTight">긴축적 통화정책</button>
        <button data-policy="fiscalEase">확장적 재정정책</button>
      </div>
      <div id="policyFlow" class="flow-lane"></div>
    </section>`;
}

function renderMoneyAggregateVisual() {
  return `
    <section class="visual-block">
      <div class="visual-head"><span>포함관계</span><h3>통화지표 M1 → M2 → Lf → L</h3></div>
      <div class="nested-money">
        <div><b>M1</b><span>현금 + 요구불예금 + 수시입출식</span></div>
        <div><b>M2</b><span>M1 + 2년 미만 예적금·금융채·MMF·RP</span></div>
        <div><b>Lf</b><span>M2 + 2년 이상 예적금·금융채·보험상품</span></div>
        <div><b>L</b><span>Lf + 국채·지방채·회사채·기업어음</span></div>
      </div>
    </section>`;
}

function renderYieldFxVisual() {
  return `
    <section class="visual-block theory-grid">
      <div class="visual-head"><span>분류</span><h3>금리 기간구조와 환율 해석 틀</h3></div>
      <div class="theory-cards">
        <article><b>기대이론</b><p>장기금리 = 미래 단기금리 기대의 평균</p></article>
        <article><b>시장분할이론</b><p>만기별 투자자 수급이 금리 구조를 결정</p></article>
        <article><b>유동성 프리미엄</b><p>장기채에는 기간위험 보상 요구</p></article>
        <article><b>선호영역가설</b><p>선호 만기 밖 투자에는 프리미엄 필요</p></article>
      </div>
      <div class="formula-board fx-board"><div><b>실질환율</b><code>명목환율 × 해외물가 / 국내물가</code></div><div><b>원화 약세</b><p>수출가격 경쟁력 ↑, 수입물가 ↑, 외화부채 부담 ↑</p></div></div>
    </section>`;
}

function renderAssetUniverseVisual() {
  return `
    <section class="visual-block asset-universe">
      <div class="visual-head"><span>지도</span><h3>투자대상 전체 구조</h3></div>
      <div class="asset-tree">
        <div class="root">투자대상</div>
        <div><b>금융상품</b><span>예금 · 채권 · 주식 · 펀드/ETF · 파생상품</span></div>
        <div><b>비금융/대체</b><span>부동산 · 리츠 · 인프라 · 원자재 · PEF/헤지펀드</span></div>
        <div><b>평가축</b><span>현금흐름 · 할인율 · 위험프리미엄 · 세금 · 유동성</span></div>
      </div>
      <div id="marketTicker" class="market-ticker"><span>시장지수 불러오는 중...</span></div>
    </section>`;
}

function renderMarketIndexVisual() {
  return `
    <section class="visual-block compact-market">
      <div class="visual-head"><span>시장</span><h3>대표 지수 확인</h3></div>
      <p class="muted-copy">KOSPI, NASDAQ 등 주요 지수는 앱에서 준실시간 데이터 로딩을 시도하고, 실패하면 확인 링크를 제공합니다.</p>
    </section>`;
}

function renderBondVisual() {
  return `
    <section class="visual-block two-col-tools" data-visual="bond">
      <article class="tool-panel">
        <h3>채권가격과 금리 민감도</h3>
        <div class="formula-board"><div><b>가격</b><code>P = Σ Cₜ/(1+y)ᵗ + F/(1+y)ⁿ</code></div><div><b>근사</b><code>ΔP/P ≈ -D*Δy + 1/2×Convexity×Δy²</code></div></div>
        <div class="controls"><label>수정듀레이션 <input id="durationInput" type="range" min="1" max="12" step="0.1" value="5"></label><label>볼록성 <input id="convexityInput" type="range" min="5" max="120" step="1" value="45"></label><label>금리 변화(bp) <input id="bpInput" type="range" min="-200" max="200" step="5" value="50"></label></div>
        <div class="result-line"><span>예상 가격 변화율</span><strong id="bondResult">-</strong></div>
        <canvas id="bondCanvas" width="620" height="240"></canvas>
      </article>
      <article class="tool-panel"><h3>CAPM 요구수익률</h3><div class="formula-board"><div><b>CAPM</b><code>E(Rᵢ)=Rᶠ+βᵢ×[E(Rₘ)-Rᶠ]</code></div></div><div class="controls"><label>무위험수익률 <input id="rfInput" type="range" min="0" max="7" step="0.1" value="3.2"></label><label>시장위험프리미엄 <input id="mrpInput" type="range" min="1" max="10" step="0.1" value="5"></label><label>베타 <input id="betaInput" type="range" min="0.2" max="2" step="0.05" value="1"></label></div><div class="result-line"><span>기대수익률</span><strong id="capmResult">-</strong></div><canvas id="capmCanvas" width="620" height="240"></canvas></article>
    </section>`;
}

function renderStatementVisual() {
  return `
    <section class="visual-block statements">
      <div class="visual-head"><span>예시 서식</span><h3>재무제표 한눈에 보기</h3></div>
      <div class="statement-grid">
        <article><h4>재무상태표</h4><div class="accounting-equation"><span>자산</span><b>=</b><span>부채</span><b>+</b><span>자본</span></div><dl><dt>자산</dt><dd>현금, 매출채권, 재고, 유형자산</dd><dt>부채</dt><dd>매입채무, 차입금, 선수금</dd><dt>자본</dt><dd>자본금, 이익잉여금</dd></dl></article>
        <article><h4>손익계산서</h4><div class="income-flow"><span>매출액</span><span>- 매출원가</span><span>= 매출총이익</span><span>- 판관비</span><span>= 영업이익</span><span>- 금융/법인세</span><span>= 당기순이익</span></div></article>
        <article><h4>현금흐름표</h4><div class="cash-flow"><span>영업활동</span><span>투자활동</span><span>재무활동</span></div><p>순이익과 현금흐름의 차이를 운전자본·감가상각·투자로 연결해 본다.</p></article>
      </div>
    </section>`;
}

function renderPlanningProcessVisual() {
  return `
    <section class="visual-block process-strip"><div class="visual-head"><span>프로세스</span><h3>재무설계 6단계</h3></div><div class="step-strip"><span>관계정립</span><span>정보수집</span><span>분석·평가</span><span>제안</span><span>실행</span><span>사후관리</span></div></section>`;
}

function renderTaxVisual() {
  return `
    <section class="visual-block tax-tool" data-visual="tax">
      <div class="visual-head">
        <span>계산</span>
        <h3>세금·계좌 빠른 계산</h3>
        <p>자격증 정리용 간이 계산입니다. 실제 신고는 최신 법령, 보유기간, 공제요건, 지방세 특례를 별도로 확인해야 합니다.</p>
      </div>
      <div class="tax-tabs" data-tax-tabs>
        <button type="button" class="active" data-tax-panel="income">종합소득</button>
        <button type="button" data-tax-panel="capitalGain">양도소득</button>
        <button type="button" data-tax-panel="isa">ISA</button>
        <button type="button" data-tax-panel="gift">증여</button>
      </div>

      <div class="tax-panel active" data-tax-panel-view="income">
        <div class="tax-layout">
          <div class="tax-inputs">
            <label>종합소득금액(만원)<input id="incomeAmount" type="number" value="6000" min="0"></label>
            <label>소득공제 합계(만원)<input id="deductionAmount" type="number" value="150" min="0"></label>
            <label>세액공제·감면(만원)<input id="taxCreditAmount" type="number" value="0" min="0"></label>
          </div>
          <div class="tax-results">
            <div><span>과세표준</span><strong id="taxBaseResult">-</strong></div>
            <div><span>산출세액</span><strong id="incomeTaxResult">-</strong></div>
            <div><span>지방소득세 포함</span><strong id="incomeLocalTaxResult">-</strong></div>
            <div><span>최고세율 구간</span><strong id="taxRateResult">-</strong></div>
          </div>
        </div>
        <div class="tax-formula">과세표준 = 종합소득금액 - 소득공제 / 결정세액 = 산출세액 - 세액공제·감면</div>
      </div>

      <div class="tax-panel" data-tax-panel-view="capitalGain">
        <div class="tax-layout">
          <div class="tax-inputs">
            <label>양도가액(만원)<input id="saleAmount" type="number" value="90000" min="0"></label>
            <label>취득가액(만원)<input id="purchaseAmount" type="number" value="65000" min="0"></label>
            <label>필요경비(만원)<input id="gainExpenseAmount" type="number" value="1200" min="0"></label>
            <label>장기보유특별공제율(%)<input id="longDeductionRate" type="number" value="0" min="0" max="80"></label>
          </div>
          <div class="tax-results">
            <div><span>양도차익</span><strong id="gainResult">-</strong></div>
            <div><span>양도소득금액</span><strong id="gainIncomeResult">-</strong></div>
            <div><span>과세표준</span><strong id="gainBaseResult">-</strong></div>
            <div><span>기본세율 산출세액</span><strong id="gainTaxResult">-</strong></div>
          </div>
        </div>
        <div class="tax-formula">양도차익 = 양도가액 - 취득가액 - 필요경비 / 과세표준 = 양도소득금액 - 기본공제 250만원</div>
      </div>

      <div class="tax-panel" data-tax-panel-view="isa">
        <div class="tax-layout">
          <div class="tax-inputs">
            <label>연 납입액(만원)<input id="isaAnnualAmount" type="number" value="2000" min="0"></label>
            <label>운용기간(년)<input id="isaYears" type="number" value="3" min="1"></label>
            <label>예상 순이익(만원)<input id="isaProfitAmount" type="number" value="300" min="0"></label>
            <label>비과세 한도(만원)<select id="isaFreeLimit"><option value="200">일반형 200</option><option value="400">서민형/농어민 400</option></select></label>
          </div>
          <div class="tax-results">
            <div><span>총 납입액</span><strong id="isaTotalContribution">-</strong></div>
            <div><span>일반 과세 추정</span><strong id="isaNormalTax">-</strong></div>
            <div><span>ISA 과세 추정</span><strong id="isaTax">-</strong></div>
            <div><span>세제효과</span><strong id="isaSavingResult">-</strong></div>
          </div>
        </div>
        <div class="tax-formula">ISA는 계좌 내 손익통산 후 비과세 한도 초과분에 저율 분리과세를 적용하는 구조로 정리한다.</div>
      </div>

      <div class="tax-panel" data-tax-panel-view="gift">
        <div class="tax-layout">
          <div class="tax-inputs">
            <label>증여재산가액(만원)<input id="giftAmount" type="number" value="12000" min="0"></label>
            <label>관계별 공제<select id="giftDeductionType"><option value="5000">성년 자녀 5,000</option><option value="2000">미성년 자녀 2,000</option><option value="60000">배우자 60,000</option><option value="1000">기타 친족 1,000</option><option value="0">공제 없음</option></select></label>
            <label>신고세액공제율(%)<input id="giftReportCreditRate" type="number" value="3" min="0" max="10"></label>
          </div>
          <div class="tax-results">
            <div><span>과세표준</span><strong id="giftBaseResult">-</strong></div>
            <div><span>산출세액</span><strong id="giftTaxResult">-</strong></div>
            <div><span>신고공제 후</span><strong id="giftAfterCreditResult">-</strong></div>
            <div><span>지방소득세 없음</span><strong>국세 기준</strong></div>
          </div>
        </div>
        <div class="tax-formula">증여세 과세표준 = 증여재산가액 - 증여재산공제. 동일인 증여는 10년 합산 여부를 별도 확인한다.</div>
      </div>

      <div class="tax-calendar">
        <b>다음 세금 일정</b>
        <span id="nextIncomeDue">종합소득세: -</span>
        <span id="nextVatDue">부가가치세 예정/확정: 1월·4월·7월·10월 점검</span>
        <span>상속세: 상속개시일이 속하는 달의 말일부터 6개월</span>
        <span>증여세: 증여일이 속하는 달의 말일부터 3개월</span>
      </div>
    </section>`;
}

function renderSalesRuleVisual() {
  return `
    <section class="visual-block regulation-flow"><div><span>1</span><strong>고객확인</strong><small>일반/전문, 목적, 재산상황</small></div><div><span>2</span><strong>적합성</strong><small>권유 상품이 고객에게 맞는가</small></div><div><span>3</span><strong>적정성</strong><small>고객이 위험을 이해하는가</small></div><div><span>4</span><strong>설명의무</strong><small>원금손실·수수료·환매조건</small></div><div><span>5</span><strong>사후관리</strong><small>기록, 분쟁, 위법계약해지</small></div></section>`;
}

function bindChapterTools(type) {
  if (type === "economics") {
    bindAdAsTool();
    bindPolicyTool();
  }
  if (type === "finance") {
    bindFinanceTools();
    loadMarketTicker();
  }
  if (type === "planning") bindTaxTool();
}

function bindAdAsTool() {
  const canvas = document.querySelector("#adasCanvas");
  if (!canvas) return;
  const buttons = document.querySelectorAll("[data-tool='adas'] button");
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    drawAdAs(button.dataset.shock);
  }));
  drawAdAs("demandUp");
}

function drawAdAs(mode) {
  const canvas = document.querySelector("#adasCanvas");
  const notes = document.querySelector("#adasNotes");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  drawAxis(ctx, w, h, mode === "phillips" ? "실업률" : mode === "laborDemand" ? "고용량" : "실질 GDP", mode === "phillips" ? "인플레이션" : mode === "laborDemand" ? "실질임금" : "물가");
  if (mode === "phillips") {
    drawCurve(ctx, [[90,80],[210,125],[340,175],[520,235]], "#116a7b", "단기 PC");
    drawCurve(ctx, [[330,55],[330,255]], "#d1495b", "장기 PC");
    notes.innerHTML = "<b>해석</b><span>단기에는 인플레이션과 실업률이 상충하지만, 장기에는 자연실업률 부근에서 수직으로 본다.</span>";
    return;
  }
  if (mode === "laborDemand") {
    drawCurve(ctx, [[100,230],[230,170],[520,80]], "#116a7b", "노동수요");
    drawCurve(ctx, [[120,75],[300,160],[540,240]], "#8f4f24", "노동공급");
    drawCurve(ctx, [[160,230],[300,160],[580,70]], "#d1495b", "수요증가");
    notes.innerHTML = "<b>노동수요 증가</b><span>균형 고용량과 실질임금이 함께 상승한다. 생산 증가와 비용 압력을 동시에 본다.</span>";
    return;
  }
  drawCurve(ctx, [[90,85],[250,145],[550,240]], "#8f4f24", "AS");
  drawCurve(ctx, [[95,235],[260,160],[555,75]], "#116a7b", "AD");
  if (mode === "demandUp") {
    drawCurve(ctx, [[155,235],[320,160],[615,75]], "#d1495b", "AD↑");
    notes.innerHTML = "<b>총수요 증가</b><span>균형 산출과 물가가 상승한다. 수요견인 인플레이션과 이익 증가 가능성을 같이 본다.</span>";
  } else {
    drawCurve(ctx, [[130,80],[290,145],[590,240]], "#d1495b", "AS↓");
    notes.innerHTML = "<b>총공급 감소</b><span>물가는 상승하고 산출은 둔화된다. 비용인상 인플레이션과 스태그플레이션 위험이다.</span>";
  }
}

function drawAxis(ctx, w, h, xLabel, yLabel) {
  ctx.strokeStyle = "#25313f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(58, 24);
  ctx.lineTo(58, h - 42);
  ctx.lineTo(w - 28, h - 42);
  ctx.stroke();
  ctx.fillStyle = "#475467";
  ctx.font = "14px Arial";
  ctx.fillText(yLabel, 16, 28);
  ctx.fillText(xLabel, w - 90, h - 14);
}

function drawCurve(ctx, points, color, label) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
  const [lx, ly] = points[Math.floor(points.length / 2)];
  ctx.fillStyle = color;
  ctx.font = "bold 14px Arial";
  ctx.fillText(label, lx + 8, ly - 8);
}

function bindPolicyTool() {
  const host = document.querySelector("#policyFlow");
  if (!host) return;
  const flows = {
    moneyEase: ["기준금리↓", "시장금리↓", "소비·투자↑", "총수요↑", "물가·자산가격↑"],
    moneyTight: ["기준금리↑", "시장금리↑", "차입비용↑", "총수요↓", "물가압력↓"],
    fiscalEase: ["정부지출↑/감세", "총수요↑", "국채발행↑", "금리상승 압력", "구축효과 점검"],
  };
  function paint(key) {
    host.innerHTML = flows[key].map((item, index) => `<div><span>${index + 1}</span><strong>${item}</strong></div>`).join("");
  }
  document.querySelectorAll("[data-tool='policy'] button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tool='policy'] button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    paint(button.dataset.policy);
  }));
  paint("moneyEase");
}

function bindFinanceTools() {
  if (document.querySelector("#durationInput")) {
    ["durationInput", "convexityInput", "bpInput"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", updateBondTool));
    ["rfInput", "mrpInput", "betaInput"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", updateCapmTool));
    updateBondTool();
    updateCapmTool();
  }
}

async function loadMarketTicker() {
  const host = document.querySelector("#marketTicker");
  if (!host) return;
  const symbols = [
    ["KOSPI", "https://stooq.com/q/l/?s=^kospi&f=sd2t2c&e=csv"],
    ["NASDAQ", "https://stooq.com/q/l/?s=^ndq&f=sd2t2c&e=csv"],
    ["S&P 500", "https://stooq.com/q/l/?s=^spx&f=sd2t2c&e=csv"],
  ];
  try {
    const rows = await Promise.all(symbols.map(async ([name, url]) => {
      const res = await fetch(url);
      const text = await res.text();
      const line = text.trim().split("\n")[1] || "";
      const cols = line.split(",");
      const close = cols[4] || "확인 필요";
      return `<a href="${url}" target="_blank" rel="noreferrer"><b>${name}</b><span>${close}</span></a>`;
    }));
    host.innerHTML = rows.join("");
  } catch (error) {
    host.innerHTML = `<a href="https://finance.yahoo.com/quote/%5EKS11" target="_blank" rel="noreferrer"><b>KOSPI</b><span>확인</span></a><a href="https://finance.yahoo.com/quote/%5EIXIC" target="_blank" rel="noreferrer"><b>NASDAQ</b><span>확인</span></a>`;
  }
}

function bindTaxTool() {
  if (!document.querySelector("[data-visual='tax']")) return;
  document.querySelectorAll("[data-tax-tabs] button").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.dataset.taxPanel;
      document.querySelectorAll("[data-tax-tabs] button").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll("[data-tax-panel-view]").forEach((view) => view.classList.toggle("active", view.dataset.taxPanelView === panel));
    });
  });
  [
    "incomeAmount", "deductionAmount", "taxCreditAmount",
    "saleAmount", "purchaseAmount", "gainExpenseAmount", "longDeductionRate",
    "isaAnnualAmount", "isaYears", "isaProfitAmount", "isaFreeLimit",
    "giftAmount", "giftDeductionType", "giftReportCreditRate"
  ].forEach((id) => {
    const node = document.querySelector(`#${id}`);
    if (!node) return;
    node.addEventListener("input", updateTaxTool);
    node.addEventListener("change", updateTaxTool);
  });
  updateTaxTool();
  updateTaxCalendar();
}

function updateTaxTool() {
  updateIncomeTaxTool();
  updateCapitalGainTaxTool();
  updateIsaTaxTool();
  updateGiftTaxTool();
}

function calculateProgressiveTax(base, brackets) {
  const bracket = brackets.find(([limit]) => base <= limit) || brackets[brackets.length - 1];
  return { tax: Math.max(0, base * bracket[1] - bracket[2]), rate: bracket[1], limit: bracket[0] };
}

function updateIncomeTaxTool() {
  const income = Number(document.querySelector("#incomeAmount")?.value || 0);
  const deduction = Number(document.querySelector("#deductionAmount")?.value || 0);
  const credit = Number(document.querySelector("#taxCreditAmount")?.value || 0);
  const base = Math.max(0, income - deduction);
  const result = calculateProgressiveTax(base, incomeTaxBrackets());
  const decided = Math.max(0, result.tax - credit);
  document.querySelector("#taxBaseResult").textContent = `${money.format(base)}만원`;
  document.querySelector("#incomeTaxResult").textContent = `${money.format(decided)}만원`;
  document.querySelector("#incomeLocalTaxResult").textContent = `${money.format(decided * 1.1)}만원`;
  document.querySelector("#taxRateResult").textContent = `${Math.round(result.rate * 100)}% 구간`;
}

function updateCapitalGainTaxTool() {
  const sale = Number(document.querySelector("#saleAmount")?.value || 0);
  const purchase = Number(document.querySelector("#purchaseAmount")?.value || 0);
  const expense = Number(document.querySelector("#gainExpenseAmount")?.value || 0);
  const longRate = Number(document.querySelector("#longDeductionRate")?.value || 0) / 100;
  const gain = Math.max(0, sale - purchase - expense);
  const gainIncome = Math.max(0, gain - gain * longRate);
  const base = Math.max(0, gainIncome - 250);
  const result = calculateProgressiveTax(base, incomeTaxBrackets());
  document.querySelector("#gainResult").textContent = `${money.format(gain)}만원`;
  document.querySelector("#gainIncomeResult").textContent = `${money.format(gainIncome)}만원`;
  document.querySelector("#gainBaseResult").textContent = `${money.format(base)}만원`;
  document.querySelector("#gainTaxResult").textContent = `${money.format(result.tax)}만원`;
}

function updateIsaTaxTool() {
  const annual = Number(document.querySelector("#isaAnnualAmount")?.value || 0);
  const years = Number(document.querySelector("#isaYears")?.value || 0);
  const profit = Number(document.querySelector("#isaProfitAmount")?.value || 0);
  const freeLimit = Number(document.querySelector("#isaFreeLimit")?.value || 200);
  const totalContribution = Math.min(annual, 2000) * Math.max(0, years);
  const normalTax = profit * 0.154;
  const isaTax = Math.max(0, profit - freeLimit) * 0.099;
  const saving = Math.max(0, normalTax - isaTax);
  document.querySelector("#isaTotalContribution").textContent = `${money.format(totalContribution)}만원`;
  document.querySelector("#isaNormalTax").textContent = `${money.format(normalTax)}만원`;
  document.querySelector("#isaTax").textContent = `${money.format(isaTax)}만원`;
  document.querySelector("#isaSavingResult").textContent = `${money.format(saving)}만원 절감`;
}

function updateGiftTaxTool() {
  const gift = Number(document.querySelector("#giftAmount")?.value || 0);
  const deduction = Number(document.querySelector("#giftDeductionType")?.value || 0);
  const creditRate = Number(document.querySelector("#giftReportCreditRate")?.value || 0) / 100;
  const base = Math.max(0, gift - deduction);
  const result = calculateProgressiveTax(base, giftTaxBrackets());
  const afterCredit = Math.max(0, result.tax - result.tax * creditRate);
  document.querySelector("#giftBaseResult").textContent = `${money.format(base)}만원`;
  document.querySelector("#giftTaxResult").textContent = `${money.format(result.tax)}만원`;
  document.querySelector("#giftAfterCreditResult").textContent = `${money.format(afterCredit)}만원`;
}

function updateTaxCalendar() {
  const node = document.querySelector("#nextIncomeDue");
  if (!node) return;
  const today = new Date();
  let year = today.getFullYear();
  let due = new Date(year, 4, 31);
  if (today > due) due = new Date(year + 1, 4, 31);
  node.textContent = `종합소득세: ${due.getFullYear()}년 5월 31일 신고·납부`;
}

function incomeTaxBrackets() {
  return [
    [1400, 0.06, 0],
    [5000, 0.15, 126],
    [8800, 0.24, 576],
    [15000, 0.35, 1544],
    [30000, 0.38, 1994],
    [50000, 0.40, 2594],
    [100000, 0.42, 3594],
    [Infinity, 0.45, 6594]
  ];
}

function giftTaxBrackets() {
  return [
    [10000, 0.10, 0],
    [50000, 0.20, 1000],
    [100000, 0.30, 6000],
    [300000, 0.40, 16000],
    [Infinity, 0.50, 46000]
  ];
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





