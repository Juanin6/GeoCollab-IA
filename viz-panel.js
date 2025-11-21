AFRAME.registerComponent('viz-panel', {
  schema: {
    chart: {type: 'selector'},
    position: {type: 'string', default: '-1 1 -7'},
    offsetY: {type: 'number', default: 1.8},
    offsetX: {type: 'number', default: 0.9}
  },
  init: function () {
    const chartEl = this.data.chart || document.querySelector('#chart');
    if (!chartEl) return;
    const panel = document.createElement('a-entity');
    panel.setAttribute('id', 'vizPanel');
    panel.setAttribute('class', 'ui-panel no-annotate');
    // El panel se coloca al lado del chart, pero NO se ancla como hijo del chart (para no borrarlo al cambiar modo)
    const placePanel = () => {
      try {
        // Valores por defecto razonables
        let cols = 7, cellSize = 0.9, gap = 0.15;
        // Intenta leer atributos del modo actual si existen
        const attrs = chartEl.getAttribute('barchart-3d') || chartEl.getAttribute('terrain-3d') || chartEl.getAttribute('points-3d') || chartEl.getAttribute('terrain-wire');
        if (attrs && typeof attrs === 'string') {
          const m = (k)=>{ const r = attrs.match(new RegExp(k+"\s*:\s*([^;]+)")); return r?parseFloat(r[1]):undefined; };
          cols = m('cols') || cols;
          cellSize = m('cellSize') || m('size') || cellSize;
          gap = m('gap') || gap;
        }
        const width = cols * (cellSize + gap);
        // Posición relativa al chart actual
        const cpos = chartEl.object3D.position;
        const y = (this.data && typeof this.data.offsetY === 'number') ? this.data.offsetY : 1.8;
        const ox = (this.data && typeof this.data.offsetX === 'number') ? this.data.offsetX : 0.9;
        panel.setAttribute('position', `${cpos.x + (width/2)+ox} ${y} ${cpos.z}`);
        panel.setAttribute('rotation', '0 0 0');
      } catch (e) {
        panel.setAttribute('position', '1.2 1.8 0');
        panel.setAttribute('rotation', '0 0 0');
      }
    };

    const bg = document.createElement('a-entity');
    bg.setAttribute('class', 'ui-panel no-annotate');
    bg.setAttribute('geometry', 'primitive: plane; width: 1.2; height: 0.8');
    bg.setAttribute('material', 'color: #0f172a; opacity: 0.9; side: double');
    panel.appendChild(bg);

    const title = document.createElement('a-text');
    title.setAttribute('value', 'Filtros');
    title.setAttribute('color', '#cde3ff');
    title.setAttribute('width', '2');
    title.setAttribute('align', 'center');
    title.setAttribute('position', '0 0.32 0.01');
    title.setAttribute('material', 'side: double');
    panel.appendChild(title);

    const makeBtn = (label, y, onClick) => {
      const btn = document.createElement('a-entity');
      btn.setAttribute('class', 'viz-option no-annotate');
      btn.setAttribute('geometry', 'primitive: plane; width: 1.0; height: 0.18');
      btn.setAttribute('material', 'color: #1a2238; opacity: 0.95; side: double');
      btn.setAttribute('position', `0 ${y} 0.01`);
      const txt = document.createElement('a-text');
      txt.setAttribute('value', label);
      txt.setAttribute('class', 'viz-option no-annotate');
      txt.setAttribute('color', '#e2f3ff');
      txt.setAttribute('align', 'center');
      txt.setAttribute('width', '1.8');
      txt.setAttribute('position', '0 0 0.01');
      txt.setAttribute('material', 'side: double');
      btn.appendChild(txt);
      btn.addEventListener('mouseenter', () => btn.setAttribute('material','color:#243047; opacity:0.98'));
      btn.addEventListener('mouseleave', () => btn.setAttribute('material','color:#1a2238; opacity:0.95'));
      btn.addEventListener('click', onClick);
      return btn;
    };

    const ensureTitle = () => {
      let t = chartEl.querySelector('.chart-title');
      if (!t) {
        t = document.createElement('a-text');
        t.setAttribute('class', 'chart-title');
        t.setAttribute('align', 'center');
        t.setAttribute('width', '6');
        t.setAttribute('color', '#e2f3ff');
        t.setAttribute('position', '0 4.6 0');
        t.setAttribute('side', 'double');
        chartEl.appendChild(t);
      }
      return t;
    };

    const setTitleForMode = (mode) => {
      const titleEl = ensureTitle();
      let title = '';
      if (mode === 'bars') title = 'Volumen de entregas por Zona × Franja (Pedidos/h)';
      else if (mode === 'terrain') title = 'Tiempo medio de entrega (min) — Terreno';
      else if (mode === 'terrain-wire') title = 'Relieve / Pendiente (contexto)';
      else if (mode === 'points') title = 'Paradas / Incidentes georreferenciados';
      titleEl.setAttribute('value', title);

      // También actualiza el tablero trasero
      const bb = document.querySelector('#backBoardMode');
      if (bb){
        let sub = '';
        if (mode === 'bars') sub = 'Barras: Volumen por Zona×Franja';
        else if (mode === 'terrain') sub = 'Terreno: Tiempo medio de entrega (min)';
        else if (mode === 'terrain-wire') sub = 'Wire: Relieve / Pendiente (contexto)';
        else if (mode === 'points') sub = 'Puntos: Paradas / Incidentes';
        bb.setAttribute('value', sub);
      }
    };

    // Estado visual de selección
    let state = { slot: null, zone: null, type: null, yThreshold: null };
    const setActiveStyle = (el, active) => {
      el.setAttribute('material', active ? 'color:#2f3c5a; opacity:1.0' : 'color:#1a2238; opacity:0.95');
    };

    const setMode = (mode) => {
      while (chartEl.firstChild) chartEl.removeChild(chartEl.firstChild);
      chartEl.removeObject3D && chartEl.removeObject3D('mesh');
      chartEl.removeAttribute('barchart-3d');
      chartEl.removeAttribute('terrain-3d');
      chartEl.removeAttribute('points-3d');
      chartEl.removeAttribute('terrain-wire');
      if (mode === 'bars') {
        chartEl.setAttribute('barchart-3d', `rows: 5; cols: 7; cellSize: 0.9; gap: 0.15; maxHeight: 3.5; yTicks: 6; minBarHeight: 0.12; debug: true; values: 3.2, 1.0, 2.5, 4.1, 5.0, 1.8, 0.6, 2.7, 1.1, 1.9, 3.0, 2.2, 2.8, 4.6, 0.3, 0.9, 1.4, 2.3, 3.7, 4.2, 5.0, 5.0, 4.4, 3.6, 2.1, 1.3, 0.5, 1.2, 1.0, 2.6, 3.3, 4.8, 2.9, 1.7, 0.4;`);
      } else if (mode === 'terrain') {
        chartEl.setAttribute('terrain-3d', 'rows:5; cols:7; cellSize:0.9; gap:0.15; maxHeight:3.5; slaHeight:1.5; yOffset:-0.6;');
      } else if (mode === 'points') {
        chartEl.setAttribute('points-3d', 'count:600; rows:5; cols:7; cellSize:0.9; gap:0.15; size:0.05; showZoneGrid:true;');
      } else if (mode === 'terrain-wire') {
        chartEl.setAttribute('terrain-wire', 'rows:80; cols:80; size:8; height:2.5; linesBothAxes:true;');
      }
      chartEl.setAttribute('data-view-type', mode);
      chartEl.emit('view-change', { viewType: mode }, false);
      // Reubica el panel tras cambiar modo
      placePanel();
      // Reset de filtros para evitar estados anteriores que oculten todo
      // Lo hacemos en el siguiente tick para que el nuevo componente ya esté montado y escuche el evento
      const reset = {};
      setTimeout(() => {
        panel.emit('filters-change', reset, false);
        panel.sceneEl && panel.sceneEl.emit('filters-change', reset, false);
        chartEl && chartEl.emit('filters-change', reset, false);
      }, 0);
      setTitleForMode(mode);
    };

    const btnBars = makeBtn('Barras 3D', 0.20, () => setMode('bars'));
    const btnTerrain = makeBtn('Terreno 3D', 0.05, () => setMode('terrain'));
    const btnTerrainWire = makeBtn('Terreno Wire', -0.10, () => setMode('terrain-wire'));
    const btnPoints = makeBtn('Puntos 3D', -0.25, () => setMode('points'));

    panel.appendChild(btnBars);
    panel.appendChild(btnTerrain);
    panel.appendChild(btnTerrainWire);
    panel.appendChild(btnPoints);

    const slotLbl = document.createElement('a-text');
    slotLbl.setAttribute('value', 'Franja');
    slotLbl.setAttribute('color', '#9fb7d7');
    slotLbl.setAttribute('width', '1.6');
    slotLbl.setAttribute('align', 'center');
    slotLbl.setAttribute('position', '0 -0.30 0.01');
    panel.appendChild(slotLbl);

    // Selector de franja horaria (7 slots)
    const slotRow = document.createElement('a-entity');
    slotRow.setAttribute('position', '0 -0.42 0');
    const makeSlot = (idx) => {
      const sbtn = document.createElement('a-entity');
      sbtn.setAttribute('class', 'viz-option');
      sbtn.setAttribute('geometry', 'primitive: plane; width: 0.12; height: 0.12');
      sbtn.setAttribute('material', 'color: #1a2238; opacity: 0.95');
      sbtn.setAttribute('position', `${(idx-3)*0.14} 0 0.01`);
      const t = document.createElement('a-text');
      t.setAttribute('value', String(idx+1));
      t.setAttribute('color', '#e2f3ff');
      t.setAttribute('align', 'center');
      t.setAttribute('width', '1');
      t.setAttribute('position', '0 0 0.01');
      sbtn.appendChild(t);
      sbtn.addEventListener('mouseenter', () => setActiveStyle(sbtn, true));
      sbtn.addEventListener('mouseleave', () => setActiveStyle(sbtn, state.slot===idx));
      sbtn.addEventListener('click', ()=>{
        // Toggle selección
        state.slot = (state.slot===idx) ? null : idx;
        // Estilos
        Array.from(slotRow.children).forEach((ch, i)=> setActiveStyle(ch, state.slot===i));
        // Emite filtro a la escena y al chart
        const detail = (state.slot===null) ? {} : { slot: state.slot };
        panel.emit('filters-change', detail, false);
        panel.sceneEl && panel.sceneEl.emit('filters-change', detail, false);
        chartEl && chartEl.emit('filters-change', detail, false);
      });
      return sbtn;
    };
    for (let i=0;i<7;i++) slotRow.appendChild(makeSlot(i));
    panel.appendChild(slotRow);

    const zoneLbl = document.createElement('a-text');
    zoneLbl.setAttribute('value', 'Zona');
    zoneLbl.setAttribute('color', '#9fb7d7');
    zoneLbl.setAttribute('width', '1.6');
    zoneLbl.setAttribute('align', 'center');
    zoneLbl.setAttribute('position', '0 -0.50 0.01');
    panel.appendChild(zoneLbl);

    // Selector de zona (filas)
    const zoneRow = document.createElement('a-entity');
    zoneRow.setAttribute('position', '0 -0.58 0');
    const makeZone = (idx) => {
      const zbtn = document.createElement('a-entity');
      zbtn.setAttribute('class', 'viz-option');
      zbtn.setAttribute('geometry', 'primitive: plane; width: 0.16; height: 0.12');
      zbtn.setAttribute('material', 'color: #1a2238; opacity: 0.95');
      zbtn.setAttribute('position', `${(idx-2)*0.18} 0 0.01`);
      const t = document.createElement('a-text');
      t.setAttribute('value', `Z${idx+1}`);
      t.setAttribute('color', '#e2f3ff');
      t.setAttribute('align', 'center');
      t.setAttribute('width', '1');
      t.setAttribute('position', '0 0 0.01');
      zbtn.appendChild(t);
      zbtn.addEventListener('mouseenter', () => setActiveStyle(zbtn, true));
      zbtn.addEventListener('mouseleave', () => setActiveStyle(zbtn, state.zone===idx));
      zbtn.addEventListener('click', ()=>{
        state.zone = (state.zone===idx) ? null : idx;
        Array.from(zoneRow.children).forEach((ch, i)=> setActiveStyle(ch, state.zone===i));
        const detail = (state.zone===null) ? {} : { zone: state.zone };
        panel.emit('filters-change', detail, false);
        panel.sceneEl && panel.sceneEl.emit('filters-change', detail, false);
        chartEl && chartEl.emit('filters-change', detail, false);
      });
      return zbtn;
    };
    for (let i=0;i<5;i++) zoneRow.appendChild(makeZone(i));
    panel.appendChild(zoneRow);

    const typeLbl = document.createElement('a-text');
    typeLbl.setAttribute('value', 'Tipo');
    typeLbl.setAttribute('color', '#9fb7d7');
    typeLbl.setAttribute('width', '1.6');
    typeLbl.setAttribute('align', 'center');
    typeLbl.setAttribute('position', '0 -0.66 0.01');
    panel.appendChild(typeLbl);

    // Selector de Tipo (Entrega / Incidente)
    const typeRow = document.createElement('a-entity');
    typeRow.setAttribute('position', '0 -0.74 0');
    const makeType = (label, val, x) => {
      const btn = document.createElement('a-entity');
      btn.setAttribute('class', 'viz-option');
      btn.setAttribute('geometry', 'primitive: plane; width: 0.36; height: 0.12');
      btn.setAttribute('material', 'color: #1a2238; opacity: 0.95; side: double');
      btn.setAttribute('position', `${x} 0 0.01`);
      const txt = document.createElement('a-text');
      txt.setAttribute('value', label);
      txt.setAttribute('color', '#e2f3ff');
      txt.setAttribute('align', 'center');
      txt.setAttribute('width', '1.6');
      txt.setAttribute('position', '0 0 0.01');
      btn.appendChild(txt);
      btn.addEventListener('mouseenter', () => setActiveStyle(btn, true));
      btn.addEventListener('mouseleave', () => setActiveStyle(btn, state.type===val));
      btn.addEventListener('click', ()=>{
        state.type = (state.type===val) ? null : val;
        Array.from(typeRow.children).forEach((ch)=>{
          const v = ch.querySelector('a-text')?.getAttribute('value');
          const is = (v===label && state.type===val) || (v!==label && false);
          // se re-evalúa abajo al final tras alternar todos
        });
        // Actualiza estilo por valor
        Array.from(typeRow.children).forEach((ch)=>{
          const v = ch.querySelector('a-text')?.getAttribute('value');
          const active = (v==='Entrega' && state.type==='delivery') || (v==='Incidente' && state.type==='incident');
          setActiveStyle(ch, active);
        });
        const detail = (state.type===null) ? {} : { type: state.type };
        panel.emit('filters-change', detail, false);
        panel.sceneEl && panel.sceneEl.emit('filters-change', detail, false);
        chartEl && chartEl.emit('filters-change', detail, false);
      });
      return btn;
    };
    typeRow.appendChild(makeType('Entrega','delivery', -0.25));
    typeRow.appendChild(makeType('Incidente','incident', 0.25));
    panel.appendChild(typeRow);

    const thrLbl = document.createElement('a-text');
    thrLbl.setAttribute('value', 'Umbral Y');
    thrLbl.setAttribute('color', '#9fb7d7');
    thrLbl.setAttribute('width', '1.6');
    thrLbl.setAttribute('align', 'center');
    thrLbl.setAttribute('position', '0 -0.82 0.01');
    panel.appendChild(thrLbl);

    // Umbral de Y (0/15/30 min)
    const thrRow = document.createElement('a-entity');
    thrRow.setAttribute('position', '0 -0.88 0');
    const makeThr = (label, minutes, x) => {
      const btn = document.createElement('a-entity');
      btn.setAttribute('class', 'viz-option');
      btn.setAttribute('geometry', 'primitive: plane; width: 0.28; height: 0.12');
      btn.setAttribute('material', 'color: #1a2238; opacity: 0.95; side: double');
      btn.setAttribute('position', `${x} 0 0.01`);
      const txt = document.createElement('a-text');
      txt.setAttribute('value', label);
      txt.setAttribute('color', '#e2f3ff');
      txt.setAttribute('align', 'center');
      txt.setAttribute('width', '1.2');
      txt.setAttribute('position', '0 0 0.01');
      btn.appendChild(txt);
      btn.addEventListener('mouseenter', () => setActiveStyle(btn, true));
      btn.addEventListener('mouseleave', () => setActiveStyle(btn, state.yThreshold===minutes));
      btn.addEventListener('click', ()=>{
        state.yThreshold = (state.yThreshold===minutes) ? null : minutes;
        Array.from(thrRow.children).forEach((ch)=>{
          const v = ch.querySelector('a-text')?.getAttribute('value');
          const active = (v==='≥ 0 min' && state.yThreshold===0) || (v==='≥ 15 min' && state.yThreshold===15) || (v==='≥ 30 min' && state.yThreshold===30);
          setActiveStyle(ch, active);
        });
        const detail = (state.yThreshold===null) ? {} : { yThreshold: state.yThreshold };
        panel.emit('filters-change', detail, false);
        panel.sceneEl && panel.sceneEl.emit('filters-change', detail, false);
        chartEl && chartEl.emit('filters-change', detail, false);
      });
      return btn;
    };
    thrRow.appendChild(makeThr('≥ 0 min', 0, -0.4));
    thrRow.appendChild(makeThr('≥ 15 min', 15, 0));
    thrRow.appendChild(makeThr('≥ 30 min', 30, 0.4));
    panel.appendChild(thrRow);

    // Se ancla el panel al contenedor del componente (no al chart) para que no desaparezca al limpiar hijos del chart
    this.el.appendChild(panel);
    placePanel();

    let initial = 'bars';
    if (chartEl.hasAttribute('terrain-3d')) initial = 'terrain';
    if (chartEl.hasAttribute('points-3d')) initial = 'points';
    if (chartEl.hasAttribute('terrain-wire')) initial = 'terrain-wire';
    chartEl.setAttribute('data-view-type', initial);
    chartEl.emit('view-change', { viewType: initial }, false);
    setTitleForMode(initial);
  }
});
