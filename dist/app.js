let guideData = null;

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

async function loadContent() {
  const response = await fetch("content.json");
  guideData = await response.json();
  renderNav();
  renderChapter(guideData.chapters[0].slug);
}

function renderNav() {
  const nav = document.querySelector("#chapterNav");
  nav.innerHTML = guideData.chapters
    .map((chapter, index) => `<button data-slug="${chapter.slug}" class="${index === 0 ? "active" : ""}">${chapter.title}</button>`)
    .join("");
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-slug]");
    if (!button) return;
    nav.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderChapter(button.dataset.slug);
  });
}

function renderChapter(slug) {
  const chapter = guideData.chapters.find((item) => item.slug === slug);
  if (chapter.title.toLowerCase() === "dictionary") {
    renderDictionaryChapter(chapter);
    return;
  }
  document.querySelector("#chapterContent").innerHTML = chapter.html;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getDictionaryEntries(markdown) {
  const entries = [];
  let category = "기타";
  markdown.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      category = line.replace(/^##\s+/, "");
      return;
    }
    if (!line || line.startsWith("#") || !line.includes(" : ")) return;
    const [term, ...definitionParts] = line.split(" : ");
    entries.push({
      category,
      term: term.trim(),
      definition: definitionParts.join(" : ").trim(),
    });
  });
  return entries;
}

function renderDictionaryChapter(chapter) {
  const entries = getDictionaryEntries(chapter.markdown);
  const host = document.querySelector("#chapterContent");
  host.innerHTML = `
    <h1>${escapeHtml(chapter.title)}</h1>
    <p>중요 개념을 빠르게 리마인드하기 위한 한 줄 사전이다. 검색어는 용어명과 설명을 함께 찾는다.</p>
    <div class="dictionary-search" role="search">
      <label for="dictionarySearch">Search dictionary</label>
      <input id="dictionarySearch" type="search" placeholder="GDP, 듀레이션, 적합성 원칙..." autocomplete="off">
      <span id="dictionaryCount">${entries.length} terms</span>
    </div>
    <div id="dictionaryResults" class="dictionary-results"></div>
  `;

  const input = host.querySelector("#dictionarySearch");
  const results = host.querySelector("#dictionaryResults");
  const count = host.querySelector("#dictionaryCount");

  function paint() {
    const query = input.value.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const haystack = `${entry.category} ${entry.term} ${entry.definition}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    count.textContent = `${filtered.length} / ${entries.length} terms`;
    results.innerHTML = renderDictionaryResults(filtered, query);
  }

  input.addEventListener("input", paint);
  paint();
}

function renderDictionaryResults(entries, query) {
  if (entries.length === 0) {
    return `<p class="dictionary-empty">검색 결과가 없습니다.</p>`;
  }
  const grouped = new Map();
  entries.forEach((entry) => {
    if (!grouped.has(entry.category)) grouped.set(entry.category, []);
    grouped.get(entry.category).push(entry);
  });

  return [...grouped.entries()]
    .map(([category, categoryEntries]) => `
      <section class="dictionary-group">
        <h2>${escapeHtml(category)}</h2>
        <dl>
          ${categoryEntries.map((entry) => `
            <div class="dictionary-entry">
              <dt>${highlightTerm(entry.term, query)}</dt>
              <dd>${highlightTerm(entry.definition, query)}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `)
    .join("");
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

function bindTools() {
  ["durationInput", "convexityInput", "bpInput"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", updateBondTool);
  });
  ["rfInput", "mrpInput", "betaInput"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", updateCapmTool);
  });
  updateBondTool();
  updateCapmTool();
}

function updateBondTool() {
  const duration = Number(document.querySelector("#durationInput").value);
  const convexity = Number(document.querySelector("#convexityInput").value);
  const bp = Number(document.querySelector("#bpInput").value);
  const dy = bp / 10000;
  const change = (-duration * dy + 0.5 * convexity * dy * dy) * 100;
  document.querySelector("#bondResult").textContent = pct(change);
  document.querySelector("#durationSignal").textContent = `${money.format(duration)}y`;
  drawBondChart(duration, convexity);
}

function updateCapmTool() {
  const rf = Number(document.querySelector("#rfInput").value);
  const mrp = Number(document.querySelector("#mrpInput").value);
  const beta = Number(document.querySelector("#betaInput").value);
  const expected = rf + beta * mrp;
  document.querySelector("#capmResult").textContent = pct(expected);
  document.querySelector("#capmSignal").textContent = pct(expected);
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
  return { canvas, ctx, width, height };
}

function drawBondChart(duration, convexity) {
  const { ctx, width, height } = prepCanvas("bondCanvas");
  const points = [];
  for (let bp = -200; bp <= 200; bp += 10) {
    const dy = bp / 10000;
    points.push({ bp, value: (-duration * dy + 0.5 * convexity * dy * dy) * 100 });
  }
  drawLine(ctx, points, width, height, "#116a7b", -12, 12, "bp", "%");
}

function drawCapmChart(rf, mrp, beta) {
  const { ctx, width, height } = prepCanvas("capmCanvas");
  const points = [];
  for (let b = 0; b <= 2; b += 0.05) {
    points.push({ bp: b, value: rf + b * mrp });
  }
  drawLine(ctx, points, width, height, "#8f4f24", 0, Math.max(16, rf + 2 * mrp), "β", "%");
  const x = 45 + (beta / 2) * (width - 65);
  const y = height - 35 - ((rf + beta * mrp) / Math.max(16, rf + 2 * mrp)) * (height - 55);
  ctx.fillStyle = "#d1495b";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLine(ctx, points, width, height, color, minY, maxY, xLabel, yLabel) {
  const minX = points[0].bp;
  const maxX = points[points.length - 1].bp;
  const plotX = (x) => 45 + ((x - minX) / (maxX - minX)) * (width - 65);
  const plotY = (y) => height - 35 - ((y - minY) / (maxY - minY)) * (height - 55);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = plotX(point.bp);
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
bindTools();
