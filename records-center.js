(() => {
  "use strict";
  const controls = document.querySelectorAll("[data-target]");
  const panels = document.querySelectorAll(".workspace");
  function show(target) {
    panels.forEach(panel => {
      const active = panel.id === target;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    controls.forEach(control => {
      const active = control.dataset.target === target;
      control.classList.toggle("is-active", active);
      if (control.classList.contains("tab")) control.setAttribute("aria-selected", String(active));
    });
  }
  controls.forEach(control => control.addEventListener("click", () => show(control.dataset.target)));
})();
