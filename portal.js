(() => {
  "use strict";

  const search = document.getElementById("toolSearch");
  const cards = Array.from(document.querySelectorAll(".tool-card"));
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const count = document.getElementById("toolCount");
  const empty = document.getElementById("emptyState");
  let activeCategory = "all";

  document.getElementById("summaryToolCount").textContent = String(cards.length);
  document.getElementById("summaryCategoryCount").textContent = String(new Set(cards.map(card => card.dataset.category)).size);

  function normalized(value) {
    return value.toLocaleLowerCase("zh-Hant").replace(/\s+/g, " ").trim();
  }

  function updateTools() {
    const keyword = normalized(search.value);
    let visibleCount = 0;
    cards.forEach(card => {
      const categoryMatch = activeCategory === "all" || card.dataset.category === activeCategory;
      const searchText = normalized(`${card.dataset.search || ""} ${card.textContent}`);
      const keywordMatch = !keyword || searchText.includes(keyword);
      card.hidden = !(categoryMatch && keywordMatch);
      if (!card.hidden) visibleCount += 1;
    });
    count.textContent = keyword || activeCategory !== "all" ? `顯示 ${visibleCount} 項工具` : `共 ${cards.length} 項工具`;
    empty.hidden = visibleCount !== 0;
  }

  filters.forEach(button => button.addEventListener("click", () => {
    activeCategory = button.dataset.filter;
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    updateTools();
  }));

  search.addEventListener("input", updateTools);
  updateTools();
})();
