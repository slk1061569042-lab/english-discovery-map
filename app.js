const state = {
  map: null,
  questions: [],
  discoveries: [],
  selectedId: null,
  category: "all",
  query: "",
  transform: { x: 0, y: 0, scale: 1 },
  svg: null,
  viewport: null,
  dragging: false,
  moved: false
};

const COLORS = {
  all: { core: "#f4f7ff", halo: "#8baeff" },
  change: { core: "#a893ff", halo: "#8c70ff" },
  space: { core: "#76a7ff", halo: "#528cff" },
  motion: { core: "#75e6e0", halo: "#42c9c2" },
  state: { core: "#8ce7b0", halo: "#50cb84" },
  perception: { core: "#f5cf7a", halo: "#e5aa45" }
};

const STATUS_LABELS = {
  explored: "Explored",
  growing: "Growing",
  seed: "Uncharted"
};

const GROWTH = {
  seed: { icon: "·", label: "种子" },
  growing: { icon: "⌁", label: "生长中" },
  tree: { icon: "✦", label: "已形成" }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function init() {
  const mapCanvas = $("#map-canvas");
  mapCanvas.innerHTML = '<div class="loading">正在校准概念宇宙…</div>';

  bindNavigation();

  try {
    const [map, questions, discoveries] = await Promise.all([
      loadJson("data/map.json"),
      loadJson("data/questions.json"),
      loadJson("data/discoveries.json")
    ]);

    state.map = map;
    state.questions = questions.questions || [];
    state.discoveries = discoveries.discoveries || [];

    renderStats();
    renderFilters();
    renderMap();
    renderQuestions();
    renderDiscoveries();
    bindSearch();
  } catch (error) {
    console.error(error);
    mapCanvas.innerHTML = `
      <div class="load-error">
        地图数据加载失败。请通过 GitHub Pages 或本地 HTTP 服务打开项目；直接双击 HTML 文件时，浏览器可能会阻止 JSON 请求。
      </div>`;
  }
}

function bindNavigation() {
  $$(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;
      $$(".nav-link").forEach(item => item.classList.toggle("active", item === button));
      $$(".view").forEach(view => view.classList.remove("active-view"));
      $(`#${target}-view`).classList.add("active-view");
      $(".toolbar").style.display = target === "map" ? "flex" : "none";
      window.location.hash = target;
    });
  });

  const initial = window.location.hash.replace("#", "");
  if (["map", "questions", "discoveries"].includes(initial) && initial !== "map") {
    $(`.nav-link[data-view="${initial}"]`)?.click();
  }
}

function renderStats() {
  const nodes = state.map.nodes;
  const explored = nodes.filter(node => node.status === "explored").length;
  const concepts = nodes.filter(node => node.level === "concept").length;
  const openQuestions = state.questions.filter(question => question.growth !== "tree").length;

  $("#hero-stats").innerHTML = [
    [concepts, "概念节点"],
    [state.map.links.length, "关系连接"],
    [explored, "已点亮"],
    [openQuestions, "待探索问题"]
  ].map(([value, label]) => `
    <div class="stat">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>`).join("");
}

function renderFilters() {
  const container = $("#filters");
  container.innerHTML = state.map.categories.map(category => `
    <button class="filter-btn ${category.id === "all" ? "active" : ""}" data-category="${category.id}">
      ${escapeHtml(category.label)}
    </button>`).join("");

  $$(".filter-btn", container).forEach(button => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      $$(".filter-btn", container).forEach(item => item.classList.toggle("active", item === button));
      applyVisibility();
    });
  });
}

function bindSearch() {
  const input = $("#search");
  input.addEventListener("input", event => {
    state.query = event.target.value.trim().toLowerCase();
    applyVisibility();
  });

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !state.query) return;
    const first = findDirectMatches()[0];
    if (first) selectNode(first.id);
  });
}

function svgEl(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function nodeRadius(node) {
  if (node.level === "core") return 45;
  if (node.level === "domain") return 34;
  return 23;
}

function renderMap() {
  const canvas = $("#map-canvas");
  canvas.innerHTML = "";

  const svg = svgEl("svg", {
    viewBox: "0 0 1100 680",
    role: "img",
    "aria-label": "可缩放与拖拽的英语概念关系地图"
  });

  const defs = svgEl("defs");
  const glow = svgEl("filter", { id: "soft-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
  glow.append(
    svgEl("feGaussianBlur", { stdDeviation: "7", result: "blur" }),
    svgEl("feMerge")
  );
  glow.lastChild.append(svgEl("feMergeNode", { in: "blur" }), svgEl("feMergeNode", { in: "SourceGraphic" }));
  defs.append(glow);
  svg.append(defs);

  const viewport = svgEl("g", { class: "viewport" });
  const backdrop = svgEl("g", { class: "backdrop" });
  [105, 210, 320, 430].forEach(radius => {
    backdrop.append(svgEl("circle", {
      class: "constellation-ring",
      cx: 550,
      cy: 335,
      r: radius
    }));
  });

  const rand = seededRandom(23);
  for (let index = 0; index < 58; index += 1) {
    const star = svgEl("circle", {
      class: "star-particle",
      cx: Math.round(rand() * 1080 + 10),
      cy: Math.round(rand() * 650 + 10),
      r: (rand() * 1.4 + .35).toFixed(2)
    });
    star.style.animationDelay = `${(rand() * 4).toFixed(2)}s`;
    backdrop.append(star);
  }
  viewport.append(backdrop);

  const linksLayer = svgEl("g", { class: "links-layer" });
  state.map.links.forEach((link, index) => {
    const source = getNode(link.source);
    const target = getNode(link.target);
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const bend = Math.min(34, Math.hypot(dx, dy) * .09) * (index % 2 ? -1 : 1);
    const mx = (source.x + target.x) / 2 - dy / Math.max(Math.hypot(dx, dy), 1) * bend;
    const my = (source.y + target.y) / 2 + dx / Math.max(Math.hypot(dx, dy), 1) * bend;

    linksLayer.append(svgEl("path", {
      class: `link-line ${link.type === "domain" || link.type === "bridge" ? "strong" : ""}`,
      d: `M ${source.x} ${source.y} Q ${mx} ${my} ${target.x} ${target.y}`,
      "data-source": link.source,
      "data-target": link.target
    }));
  });
  viewport.append(linksLayer);

  const nodesLayer = svgEl("g", { class: "nodes-layer" });
  state.map.nodes.forEach(node => nodesLayer.append(createNodeElement(node)));
  viewport.append(nodesLayer);

  svg.append(viewport);
  canvas.append(svg);
  canvas.append(createMapControls());

  state.svg = svg;
  state.viewport = viewport;
  updateTransform();
  bindMapGestures(canvas, svg);
  applyVisibility();
}

function createNodeElement(node) {
  const radius = nodeRadius(node);
  const palette = COLORS[node.category] || COLORS.all;
  const group = svgEl("g", {
    class: "node",
    transform: `translate(${node.x} ${node.y})`,
    "data-id": node.id,
    tabindex: "0",
    role: "button",
    "aria-label": `${node.label}: ${node.coreModel}`
  });

  const halo = svgEl("circle", {
    class: "halo",
    r: radius * 1.9,
    fill: palette.halo,
    filter: "url(#soft-glow)"
  });
  const orbit = svgEl("circle", {
    class: "orbit",
    r: radius * 1.45,
    stroke: palette.core
  });
  const core = svgEl("circle", {
    class: "core",
    r: radius,
    fill: palette.core,
    "fill-opacity": node.status === "seed" ? ".12" : node.status === "growing" ? ".22" : ".34"
  });
  core.style.filter = `drop-shadow(0 0 ${node.status === "seed" ? 5 : 12}px ${palette.halo})`;

  const title = svgEl("text", { y: node.level === "concept" ? 4 : 2, "font-size": node.level === "core" ? 16 : node.level === "domain" ? 14 : 12 });
  title.textContent = node.label;

  group.append(halo, orbit, core, title);

  if (node.level !== "concept") {
    const subtitle = svgEl("text", { class: "node-subtitle", y: node.level === "core" ? 22 : 18 });
    subtitle.textContent = node.subtitle;
    group.append(subtitle);
  }

  group.addEventListener("click", event => {
    if (state.moved) return;
    event.stopPropagation();
    selectNode(node.id);
  });
  group.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") selectNode(node.id);
  });
  group.addEventListener("mouseenter", () => highlightNeighborhood(node.id, true));
  group.addEventListener("mouseleave", () => highlightNeighborhood(node.id, false));
  return group;
}

function createMapControls() {
  const controls = document.createElement("div");
  controls.className = "map-controls";
  controls.innerHTML = `
    <button type="button" data-action="zoom-in" aria-label="放大">＋</button>
    <button type="button" data-action="zoom-out" aria-label="缩小">−</button>
    <button type="button" data-action="reset" aria-label="重置视图">⌂</button>`;

  controls.addEventListener("click", event => {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "zoom-in") zoomBy(1.18, 550, 335);
    if (action === "zoom-out") zoomBy(.84, 550, 335);
    if (action === "reset") {
      state.transform = { x: 0, y: 0, scale: 1 };
      updateTransform();
    }
  });
  return controls;
}

function bindMapGestures(canvas, svg) {
  let last = null;

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const px = (event.clientX - rect.left) * 1100 / rect.width;
    const py = (event.clientY - rect.top) * 680 / rect.height;
    zoomBy(event.deltaY < 0 ? 1.1 : .91, px, py);
  }, { passive: false });

  canvas.addEventListener("pointerdown", event => {
    if (event.target.closest?.(".map-controls")) return;
    state.dragging = true;
    state.moved = false;
    last = { x: event.clientX, y: event.clientY };
    canvas.classList.add("dragging");
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!state.dragging || !last) return;
    const rect = svg.getBoundingClientRect();
    const dx = (event.clientX - last.x) * 1100 / rect.width;
    const dy = (event.clientY - last.y) * 680 / rect.height;
    if (Math.abs(dx) + Math.abs(dy) > 1) state.moved = true;
    state.transform.x += dx;
    state.transform.y += dy;
    last = { x: event.clientX, y: event.clientY };
    updateTransform();
  });

  const stop = () => {
    state.dragging = false;
    last = null;
    canvas.classList.remove("dragging");
    setTimeout(() => { state.moved = false; }, 0);
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("dblclick", () => {
    state.transform = { x: 0, y: 0, scale: 1 };
    updateTransform();
  });
}

function zoomBy(factor, px, py) {
  const oldScale = state.transform.scale;
  const newScale = Math.min(2.8, Math.max(.65, oldScale * factor));
  const ratio = newScale / oldScale;
  state.transform.x = px - ratio * (px - state.transform.x);
  state.transform.y = py - ratio * (py - state.transform.y);
  state.transform.scale = newScale;
  updateTransform();
}

function updateTransform() {
  if (!state.viewport) return;
  const { x, y, scale } = state.transform;
  state.viewport.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
}

function getNode(id) {
  return state.map?.nodes.find(node => node.id === id);
}

function getNeighborIds(id) {
  const neighbors = new Set();
  state.map.links.forEach(link => {
    if (link.source === id) neighbors.add(link.target);
    if (link.target === id) neighbors.add(link.source);
  });
  return neighbors;
}

function findDirectMatches() {
  if (!state.query) return [];
  return state.map.nodes.filter(node => {
    const haystack = [
      node.id,
      node.label,
      node.subtitle,
      node.coreModel,
      node.description,
      ...(node.examples || []).flatMap(example => [example.en, example.zh])
    ].join(" ").toLowerCase();
    return haystack.includes(state.query);
  });
}

function applyVisibility() {
  if (!state.map || !state.svg) return;
  const directMatches = new Set(findDirectMatches().map(node => node.id));
  const relatedMatches = new Set();
  directMatches.forEach(id => getNeighborIds(id).forEach(neighbor => relatedMatches.add(neighbor)));

  $$(".node", state.svg).forEach(element => {
    const node = getNode(element.dataset.id);
    const categoryVisible = state.category === "all" || node.category === state.category || node.level === "core" || node.level === "domain";
    const searchVisible = !state.query || directMatches.has(node.id) || relatedMatches.has(node.id);
    element.classList.toggle("dimmed", !categoryVisible || !searchVisible);
    element.classList.toggle("related", Boolean(state.query) && relatedMatches.has(node.id) && !directMatches.has(node.id));
    element.classList.toggle("active", node.id === state.selectedId || directMatches.has(node.id));
  });

  $$(".link-line", state.svg).forEach(line => {
    const source = line.dataset.source;
    const target = line.dataset.target;
    const categoryLink = state.category === "all" || [source, target].some(id => {
      const node = getNode(id);
      return node.category === state.category || node.level === "core";
    });
    const searchLink = !state.query || [source, target].some(id => directMatches.has(id));
    line.classList.toggle("dimmed", !categoryLink || !searchLink);
    line.classList.toggle("active", state.selectedId && (source === state.selectedId || target === state.selectedId));
  });
}

function highlightNeighborhood(id, enter) {
  if (state.query || state.selectedId) return;
  const neighbors = getNeighborIds(id);
  $$(".node", state.svg).forEach(element => {
    const keep = element.dataset.id === id || neighbors.has(element.dataset.id);
    element.classList.toggle("dimmed", enter && !keep);
    element.classList.toggle("related", enter && neighbors.has(element.dataset.id));
  });
  $$(".link-line", state.svg).forEach(line => {
    const connected = line.dataset.source === id || line.dataset.target === id;
    line.classList.toggle("dimmed", enter && !connected);
    line.classList.toggle("active", enter && connected);
  });
  if (!enter) applyVisibility();
}

function selectNode(id) {
  const node = getNode(id);
  if (!node) return;
  state.selectedId = id;
  renderDetail(node);
  applyVisibility();

  if (window.innerWidth < 1100) {
    $("#detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderDetail(node) {
  const panel = $("#detail-panel");
  const connections = state.map.links
    .filter(link => link.source === node.id || link.target === node.id)
    .map(link => ({
      node: getNode(link.source === node.id ? link.target : link.source),
      label: link.label
    }))
    .filter(item => item.node);

  const questions = state.questions.filter(question => question.related.includes(node.id));
  const palette = COLORS[node.category] || COLORS.all;

  panel.innerHTML = `
    <div class="detail-content">
      <div class="detail-topline">
        <span class="status-badge"><i class="dot ${node.status}"></i>${STATUS_LABELS[node.status]}</span>
        <span class="category-badge">${escapeHtml(node.category)}</span>
      </div>
      <h3 class="detail-title" style="text-shadow:0 0 32px ${palette.halo}55">${escapeHtml(node.label)}</h3>
      <p class="detail-subtitle">${escapeHtml(node.subtitle)}</p>
      <div class="core-card">
        <small>CORE MODEL</small>
        <strong>${escapeHtml(node.coreModel)}</strong>
      </div>
      <p class="detail-description">${escapeHtml(node.description)}</p>
      ${node.examples?.length ? `
        <div class="detail-section">
          <h4>Examples</h4>
          <div class="example-list">
            ${node.examples.map(example => `
              <div class="example">${escapeHtml(example.en)}<em>${escapeHtml(example.zh)}</em></div>`).join("")}
          </div>
        </div>` : ""}
      ${connections.length ? `
        <div class="detail-section">
          <h4>Connections</h4>
          <div class="connection-list">
            ${connections.map(connection => `
              <button class="connection-btn" data-node-id="${connection.node.id}">
                <span>${escapeHtml(connection.node.label)}</span>
                <span>${escapeHtml(connection.label)} →</span>
              </button>`).join("")}
          </div>
        </div>` : ""}
      ${questions.length ? `
        <div class="detail-section">
          <h4>Open Questions</h4>
          <div class="node-question-list">
            ${questions.map(question => `<div class="node-question">${escapeHtml(question.title)}</div>`).join("")}
          </div>
        </div>` : ""}
    </div>`;

  $$(".connection-btn", panel).forEach(button => {
    button.addEventListener("click", () => selectNode(button.dataset.nodeId));
  });
}

function renderQuestions() {
  const container = $("#question-grid");
  container.innerHTML = state.questions.map(question => {
    const growth = GROWTH[question.growth] || GROWTH.seed;
    return `
      <article class="question-card">
        <div class="growth-icon">${growth.icon}</div>
        <h3>${escapeHtml(question.title)}</h3>
        <p>${escapeHtml(question.note)}</p>
        <div class="question-meta">
          <span>${growth.label}</span>
          <span>${question.related.map(id => `#${escapeHtml(id)}`).join(" ")}</span>
        </div>
      </article>`;
  }).join("");
}

function renderDiscoveries() {
  const container = $("#timeline");
  container.innerHTML = state.discoveries.map(discovery => `
    <article class="timeline-item">
      <div class="timeline-head">
        <span class="timeline-version">${escapeHtml(discovery.version)}</span>
        <time class="timeline-date">${escapeHtml(discovery.date)}</time>
      </div>
      <h3>${escapeHtml(discovery.title)}</h3>
      <p>${escapeHtml(discovery.description)}</p>
      <div class="discovery-tags">
        ${discovery.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>`).join("");
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

document.addEventListener("DOMContentLoaded", init);
