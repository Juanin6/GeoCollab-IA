AFRAME.registerComponent("terrain-3d", {
  schema: {
    rows: { type: "int", default: 20 },
    cols: { type: "int", default: 20 },
    cellSize: { type: "number", default: 0.5 },
    gap: { type: "number", default: 0.05 },
    maxHeight: { type: "number", default: 2.5 },
    slaHeight: { type: "number", default: 1.5 },
    seed: { type: "number", default: 1 },
    showLabels: { type: "boolean", default: true },
    labelOffset: { type: "number", default: 0.15 },
    labelColor: { type: "string", default: "#e2f3ff" },
    yOffset: { type: "number", default: 0 },
  },
  init: function () {
    const s = this.data;
    const root = this.el;
    const n2 = (x, y) => {
      const v =
        Math.sin(
          (x + 1.234) * 12.9898 + (y + 9.876) * 78.233 + s.seed * 0.12345
        ) * 43758.5453;
      return v - Math.floor(v);
    };
    const cityPool = [
      "Bogota",
      "Medellin",
      "Cali",
      "Barranquilla",
      "Cartagena",
      "Cucuta",
      "Bucaramanga",
      "Soacha",
      "Ibague",
      "Villavicencio",
      "Pereira",
      "Santa Marta",
      "Manizales",
      "Monteria",
      "Neiva",
      "Popayan",
      "Sincelejo",
      "Valledupar",
      "Pasto",
      "Armenia",
      "Tunja",
      "Riohacha",
      "Yopal",
      "Quibdo",
      "Leticia",
      "Florencia",
      "Mocoa",
      "Arauca",
      "San Andres",
      "Mitu",
      "Puerto Carreno",
      "Tumaco",
      "Girardot",
      "Tulua",
      "Palmira",
      "Soledad",
    ];
    let cityIdx = 0;
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const h = 0.1 + n2(r, c) * s.maxHeight;
        const x = (c - (s.cols - 1) / 2) * (s.cellSize + s.gap);
        const z = (r - (s.rows - 1) / 2) * (s.cellSize + s.gap);
        const y = h / 2;
        const e = document.createElement("a-entity");
        e.setAttribute("position", `${x} ${y + s.yOffset} ${z}`);
        e.setAttribute(
          "geometry",
          `primitive: box; width: ${s.cellSize}; depth: ${s.cellSize}; height: ${h}`
        );
        const color = this._turbo(h / s.maxHeight);
        e.setAttribute(
          "material",
          `color: ${color}; metalness: 0.1; roughness: 0.6`
        );
        e.dataset.metric = "avg_delivery_time_min";
        e.dataset.zone = String(r);
        e.dataset.slot = String(c);
        const minutes = (h / s.maxHeight) * 60;
        e.dataset.value = String(minutes.toFixed(1));
        e.classList.add("collidable");
        root.appendChild(e);

        if (s.showLabels) {
          const label = document.createElement("a-text");
          const city = cityPool[cityIdx % cityPool.length];
          cityIdx++;
          label.setAttribute("value", `${city}: ${minutes.toFixed(1)} min`);
          label.setAttribute("color", s.labelColor);
          label.setAttribute("align", "center");
          label.setAttribute("width", 2.2);
          label.setAttribute(
            "position",
            `${x} ${h + s.labelOffset + s.yOffset} ${z}`
          );
          label.dataset.zone = String(r);
          label.dataset.slot = String(c);
          root.appendChild(label);
        }
      }
    }

    // Plano SLA de referencia
    const plane = document.createElement("a-plane");
    plane.setAttribute("width", s.cols * (s.cellSize + s.gap) + 0.2);
    plane.setAttribute("height", s.rows * (s.cellSize + s.gap) + 0.2);
    plane.setAttribute("rotation", "-90 0 0");
    plane.setAttribute("position", `0 ${s.slaHeight + s.yOffset} 0`);
    plane.setAttribute(
      "material",
      "color: #ffffff; opacity: 0.08; side: double"
    );
    root.appendChild(plane);
  },
  play: function () {
    const onFilter = (e) => {
      const slot =
        e && e.detail && typeof e.detail.slot === "number"
          ? e.detail.slot
          : null;
      const zone =
        e && e.detail && typeof e.detail.zone === "number"
          ? e.detail.zone
          : null;
      const children = this.el.children;
      for (let i = 0; i < children.length; i++) {
        const ch = children[i];
        if (ch && ch.dataset && ch.dataset.slot !== undefined) {
          if (slot === null && zone === null) {
            ch.setAttribute("visible", true);
            continue;
          }
          const matchSlot = slot === null || Number(ch.dataset.slot) === slot;
          const matchZone = zone === null || Number(ch.dataset.zone) === zone;
          ch.setAttribute("visible", matchSlot && matchZone);
        }
      }
    };
    this._onFilterRef = onFilter;
    this.el.addEventListener("filters-change", onFilter);
    this.el.sceneEl &&
      this.el.sceneEl.addEventListener("filters-change", onFilter);
  },
  pause: function () {
    if (this._onFilterRef) {
      this.el.removeEventListener("filters-change", this._onFilterRef);
      this.el.sceneEl &&
        this.el.sceneEl.removeEventListener(
          "filters-change",
          this._onFilterRef
        );
    }
  },
  _turbo: function (t) {
    t = Math.max(0, Math.min(1, t));
    // Simple 5-stop approximation of turbo colormap
    const stops = [
      [0.0, [48, 18, 59]],
      [0.25, [0, 132, 201]],
      [0.5, [50, 236, 173]],
      [0.75, [255, 191, 0]],
      [1.0, [180, 4, 38]],
    ];
    const lerp = (a, b, u) => a + (b - a) * u;
    let a = stops[0],
      b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    const r = Math.round(lerp(a[1][0], b[1][0], u));
    const g = Math.round(lerp(a[1][1], b[1][1], u));
    const bl = Math.round(lerp(a[1][2], b[1][2], u));
    return `#${("0" + r.toString(16)).slice(-2)}${("0" + g.toString(16)).slice(
      -2
    )}${("0" + bl.toString(16)).slice(-2)}`;
  },
});
