function findDirectMatches() {
  if (!state.query) return [];

  const query = state.query.trim().toLowerCase();
  const exact = state.map.nodes.filter(node =>
    node.id.toLowerCase() === query || node.label.toLowerCase() === query
  );

  if (exact.length) return exact;

  const terms = query.split(/\s+/).filter(Boolean);
  return state.map.nodes.filter(node => {
    const haystack = [
      node.id,
      node.label,
      node.subtitle,
      node.coreModel,
      node.description,
      ...(node.examples || []).flatMap(example => [example.en, example.zh])
    ].join(" ").toLowerCase();

    return terms.every(term => haystack.includes(term));
  });
}

function activateViewFromHash() {
  const view = window.location.hash.replace("#", "") || "map";
  if (!["map", "questions", "discoveries"].includes(view)) return;

  const button = document.querySelector(`.nav-link[data-view="${view}"]`);
  if (button && !button.classList.contains("active")) button.click();
}

window.addEventListener("hashchange", activateViewFromHash);

document.querySelector(".brand")?.addEventListener("click", event => {
  event.preventDefault();
  document.querySelector('.nav-link[data-view="map"]')?.click();
});

document.addEventListener("keydown", event => {
  const search = document.querySelector("#search");

  if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search?.focus();
  }

  if (event.key === "Escape" && search) {
    search.value = "";
    state.query = "";
    state.selectedId = null;
    applyVisibility();
    search.blur();
  }
});
