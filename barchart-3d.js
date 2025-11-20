AFRAME.registerComponent("barchart-3d", {
  schema: {
    rows: { type: "int", default: 5 },
    cols: { type: "int", default: 7 },
    cellSize: { type: "number", default: 0.9 },
    gap: { type: "number", default: 0.15 },
    maxHeight: { type: "number", default: 3.5 },
    yTicks: { type: "int", default: 6 },
    values: { type: "string", default: "" },
    minBarHeight: { type: "number", default: 0.12 },
    debug: { type: "boolean", default: true },
  },

  update: function() {},

  play: function(){
    // Responder a filtros de franja (slot)
    const onFilter = (e)=>{
      const slot = (e && e.detail && typeof e.detail.slot === 'number') ? e.detail.slot : null;
      const zone = (e && e.detail && typeof e.detail.zone === 'number') ? e.detail.zone : null;
      const children = this.el.children;
      for (let i=0;i<children.length;i++){
        const ch = children[i];
        if (ch && ch.dataset && ch.dataset.slot !== undefined){
          if (slot===null && zone===null){ ch.setAttribute('visible', true); continue; }
          const matchSlot = slot===null || Number(ch.dataset.slot) === slot;
          const matchZone = zone===null || Number(ch.dataset.zone) === zone;
          ch.setAttribute('visible', matchSlot && matchZone);
        }
      }
    };
    this._onFilterRef = onFilter;
    this.el.addEventListener('filters-change', onFilter);
    this.el.sceneEl && this.el.sceneEl.addEventListener('filters-change', onFilter);
  },

  pause: function(){
    if (this._onFilterRef){
      this.el.removeEventListener('filters-change', this._onFilterRef);
      this.el.sceneEl && this.el.sceneEl.removeEventListener('filters-change', this._onFilterRef);
    }
  },

  init: function () {
    const d = this.data;

    // Datos
    let raw =
      d.values && d.values.trim()
        ? d.values.split(",").map((v) => parseFloat(v.trim()))
        : Array.from({ length: d.rows * d.cols }, () => Math.random() * 5);
    const vals = raw.map((v) => (Number.isFinite(v) ? v : 0));
    const vmax = Math.max(...(vals.length ? vals : [0.000001]));
    const hOf = (v) => (vmax > 0 ? (v / vmax) * d.maxHeight : 0);

    // Contenedor
    const root = document.createElement("a-entity");
    this.el.appendChild(root);

    // Ejes + Ticks
    this._addAxes(root, d);
    this._addYTicks(root, d);

    // Rejilla
    const W = d.cols * d.cellSize + (d.cols - 1) * d.gap;
    const D = d.rows * d.cellSize + (d.rows - 1) * d.gap;
    const ox = -W / 2 + d.cellSize / 2;
    const oz = -D / 2 + d.cellSize / 2;

    // Tooltip
    const tip = this._createTooltip();
    root.appendChild(tip);

    // Barras: usar SCALE.Y en vez de geometry.height
    for (let r = 0; r < d.rows; r++) {
      for (let c = 0; c < d.cols; c++) {
        const i = r * d.cols + c;
        const v = vals[i] ?? 0;
        const h = Math.max(hOf(v), d.minBarHeight);

        const x = ox + c * (d.cellSize + d.gap);
        const z = oz + r * (d.cellSize + d.gap);

        // Base con altura 1 y escala en Y = h
        const bar = document.createElement("a-box");
        bar.classList.add("collidable");
        bar.setAttribute("width", d.cellSize);
        bar.setAttribute("depth", d.cellSize);
        bar.setAttribute("height", 1); // altura "base" = 1
        bar.setAttribute("scale", { x: 1, y: 0.001, z: 1 }); // empezamos muy pequeña

        // Fijar X/Z directamente sobre object3D (más robusto)
        bar.object3D.position.set(x, 0, z);

        const norm = vmax ? v / vmax : 0;
        bar.setAttribute(
          "material",
          `color: ${this._slaColor(norm)}; metalness: 0.2; roughness: 0.4;`
        );
        // Metadatos para filtros y anotaciones
        bar.dataset.zone = String(r);
        bar.dataset.slot = String(c);
        bar.dataset.value = String(v.toFixed(2));
        bar.dataset.metric = 'deliveries_per_hour';

        // Animar escala en Y hasta h y posicionar a h/2
        bar.setAttribute("animation__scale", {
          property: "scale.y",
          from: 0.001,
          to: h,
          dur: 700,
          easing: "easeOutCubic",
          delay: i * 15,
        });
        bar.setAttribute("animation__rise", {
          property: "object3D.position.y", // animamos el y del object3D directo
          from: 0,
          to: h / 2,
          dur: 700,
          easing: "easeOutCubic",
          delay: i * 15,
        });

        // Tooltip
        bar.dataset.value = v.toFixed(2);
        bar.addEventListener("mouseenter", () => {
          bar.setAttribute("material", "emissive", "#00ffff");
          bar.setAttribute("material", "emissiveIntensity", 0.35);
          const p = bar.object3D.position;
          tip.setAttribute("position", {
            x: p.x,
            y: bar.object3D.scale.y + 0.3,
            z: p.z,
          });
          tip
            .querySelector("a-text")
            .setAttribute("value", `r:${r} c:${c}\nval:${bar.dataset.value}`);
          tip.setAttribute("visible", true);
        });
        bar.addEventListener("mouseleave", () => {
          bar.setAttribute("material", "emissive", "#000000");
          bar.setAttribute("material", "emissiveIntensity", 0);
          tip.setAttribute("visible", false);
        });

        root.appendChild(bar);

        // Debug opcional
        if (d.debug) {
          const tile = document.createElement("a-plane");
          tile.setAttribute("width", d.cellSize);
          tile.setAttribute("height", d.cellSize);
          tile.setAttribute("rotation", "-90 0 0");
          tile.setAttribute(
            "material",
            "color: #243047; opacity: 0.35; side: double"
          );
          tile.setAttribute("position", { x, y: 0.001, z });
          root.appendChild(tile);

          const tag = document.createElement("a-text");
          tag.setAttribute("value", `${r},${c}`);
          tag.setAttribute("width", 2);
          tag.setAttribute("align", "center");
          tag.setAttribute("color", "#8aa0b8");
          tag.setAttribute("position", { x, y: 0.02, z });
          tag.setAttribute("rotation", "-90 0 0");
          root.appendChild(tag);
        }
      }
    }
  },

  _addAxes(root, d) {
    const W = d.cols * d.cellSize + (d.cols - 1) * d.gap;
    const D = d.rows * d.cellSize + (d.rows - 1) * d.gap;
    const mk = (pos, scale) => {
      const a = document.createElement("a-box");
      a.setAttribute("width", scale.x);
      a.setAttribute("height", scale.y);
      a.setAttribute("depth", scale.z);
      a.setAttribute("material", "color: #1a2238; opacity: 0.95");
      a.setAttribute("position", pos);
      return a;
    };
    root.appendChild(
      mk({ x: 0, y: 0.01, z: -D / 2 - 0.05 }, { x: W, y: 0.02, z: 0.02 })
    );
    root.appendChild(
      mk({ x: -W / 2 - 0.05, y: 0.01, z: 0 }, { x: 0.02, y: 0.02, z: D })
    );
    root.appendChild(
      mk(
        { x: -W / 2 - 0.2, y: d.maxHeight / 2, z: -D / 2 - 0.2 },
        { x: 0.02, y: d.maxHeight, z: 0.02 }
      )
    );

    const label = (text, pos, rot = "0 0 0") => {
      const t = document.createElement("a-text");
      t.setAttribute("value", text);
      t.setAttribute("align", "center");
      t.setAttribute("width", 3);
      t.setAttribute("position", pos);
      t.setAttribute("rotation", rot);
      t.setAttribute("color", "#cde3ff");
      return t;
    };
    root.appendChild(label("Franja horaria", { x: 0, y: 0.15, z: -D / 2 - 0.45 }));
    root.appendChild(label("Zona", { x: -W / 2 - 0.45, y: 0.15, z: 0 }, "0 90 0"));
    root.appendChild(
      label("Pedidos/h", { x: -W / 2 - 0.25, y: d.maxHeight + 0.2, z: -D / 2 - 0.25 })
    );
  },

  _addYTicks(root, d) {
    const W = d.cols * d.cellSize + (d.cols - 1) * d.gap;
    const D = d.rows * d.cellSize + (d.rows - 1) * d.gap;
    for (let i = 0; i <= d.yTicks; i++) {
      const y = (i / d.yTicks) * d.maxHeight;
      const tick = document.createElement("a-box");
      tick.setAttribute("width", W);
      tick.setAttribute("height", 0.005);
      tick.setAttribute("depth", 0.005);
      tick.setAttribute("material", "color: #2a3653; opacity: 0.8");
      tick.setAttribute("position", { x: 0, y, z: -D / 2 - 0.2 });
      root.appendChild(tick);

      const lbl = document.createElement("a-text");
      lbl.setAttribute("value", y.toFixed(1));
      lbl.setAttribute("align", "right");
      lbl.setAttribute("width", 2.5);
      lbl.setAttribute("position", { x: -W / 2 - 0.25, y, z: -D / 2 - 0.25 });
      lbl.setAttribute("color", "#9bb3cc");
      root.appendChild(lbl);
    }
  },

  _createTooltip() {
    const tip = document.createElement("a-entity");
    tip.setAttribute("visible", false);

    const plate = document.createElement("a-plane");
    plate.setAttribute("width", 0.9);
    plate.setAttribute("height", 0.35);
    plate.setAttribute("material", "color: #0f172a; opacity: 0.9");
    plate.setAttribute("position", { x: 0, y: 0, z: 0 });
    tip.appendChild(plate);

    const text = document.createElement("a-text");
    text.setAttribute("value", "");
    text.setAttribute("align", "center");
    text.setAttribute("color", "#e2f3ff");
    text.setAttribute("width", 1.6);
    text.setAttribute("position", { x: 0, y: 0, z: 0.01 });
    tip.appendChild(text);

    return tip;
  },

  _color(t) {
    t = Math.min(1, Math.max(0, t));
    // Gradient: deep purple -> magenta -> cyan
    const stops = [
      [0.0, [45, 0, 90]],   // #2d005a
      [0.5, [255, 0, 170]], // #ff00aa
      [1.0, [0, 209, 255]]  // #00d1ff
    ];
    const lerp = (a,b,t)=>a+(b-a)*t;
    let c0 = stops[0][1], c1 = stops[2][1], tt = t;
    if (t <= 0.5) { c0 = stops[0][1]; c1 = stops[1][1]; tt = t/0.5; }
    else { c0 = stops[1][1]; c1 = stops[2][1]; tt = (t-0.5)/0.5; }
    const r = Math.round(lerp(c0[0], c1[0], tt));
    const g = Math.round(lerp(c0[1], c1[1], tt));
    const b = Math.round(lerp(c0[2], c1[2], tt));
    return `#${("0"+r.toString(16)).slice(-2)}${("0"+g.toString(16)).slice(-2)}${("0"+b.toString(16)).slice(-2)}`;
  },

  _slaColor(t){
    // t ~ % de objetivo (proxy). Umbrales: verde (>0.9), ámbar (0.7-0.9), rojo (<0.7)
    if (t >= 0.9) return '#2ecc71';
    if (t >= 0.7) return '#f1c40f';
    return '#e74c3c';
  },
});
