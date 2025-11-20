AFRAME.registerComponent('points-3d', {
  schema: {
    count: {type: 'int', default: 500},
    spread: {type: 'number', default: 5},
    size: {type: 'number', default: 0.05},
    seed: {type: 'number', default: 1},
    colorBySlot: {type: 'boolean', default: true},
    showZoneGrid: {type: 'boolean', default: true},
    rows: {type: 'int', default: 5},
    cols: {type: 'int', default: 7},
    cellSize: {type: 'number', default: 0.9},
    gap: {type: 'number', default: 0.15},
    showLegend: {type: 'boolean', default: true},
    showAxes: {type: 'boolean', default: true}
  },
  init: function () {
    const s = this.data;
    const root = this.el;
    const rnd = (i)=>{
      const v = Math.sin((i+1.234)*12.9898 + s.seed*78.233)*43758.5453;
      return v - Math.floor(v);
    };

    // Marco espacial común (calculado siempre)
    const W = s.cols * s.cellSize + (s.cols - 1) * s.gap;
    const D = s.rows * s.cellSize + (s.rows - 1) * s.gap;
    const ox = -W / 2 + s.cellSize / 2;
    const oz = -D / 2 + s.cellSize / 2;

    // Opcional: rejilla de zonas alineada a rows x cols
    if (s.showZoneGrid){
      for (let r=0;r<s.rows;r++){
        for (let c=0;c<s.cols;c++){
          const x = ox + c * (s.cellSize + s.gap);
          const z = oz + r * (s.cellSize + s.gap);
          const tile = document.createElement('a-plane');
          tile.setAttribute('width', s.cellSize);
          tile.setAttribute('height', s.cellSize);
          tile.setAttribute('rotation', '-90 0 0');
          tile.setAttribute('material', 'color: #243047; opacity: 0.25; side: double');
          tile.setAttribute('position', `${x} 0.001 ${z}`);
          root.appendChild(tile);
          const tag = document.createElement('a-text');
          tag.setAttribute('value', `Z${r+1}`);
          tag.setAttribute('color', '#9bb3cc');
          tag.setAttribute('width', 2);
          tag.setAttribute('align', 'center');
          tag.setAttribute('position', `${x} 0.02 ${z}`);
          tag.setAttribute('rotation', '-90 0 0');
          root.appendChild(tag);
        }
      }
    }

    // Agregadores por celda (conteo y promedio de minutos)
    const agg = Array.from({length:s.rows},()=>Array.from({length:s.cols},()=>({count:0,sumMin:0})));

    // Tooltip reutilizable
    const tip = document.createElement('a-entity');
    tip.setAttribute('visible', false);
    const tbg = document.createElement('a-plane');
    tbg.setAttribute('width', 0.95);
    tbg.setAttribute('height', 0.38);
    tbg.setAttribute('material', 'color: #0f172a; opacity: 0.9');
    tip.appendChild(tbg);
    const ttxt = document.createElement('a-text');
    ttxt.setAttribute('value', '');
    ttxt.setAttribute('width', 1.7);
    ttxt.setAttribute('align', 'center');
    ttxt.setAttribute('color', '#e2f3ff');
    ttxt.setAttribute('position', '0 0 0.01');
    tip.appendChild(ttxt);
    root.appendChild(tip);

    // Puntos con significado: Y= minutos; tamaño= severidad; color=franja; tipo=entrega/incidente
    for (let i=0;i<s.count;i++){
      const zone = Math.floor(rnd(i*11)*s.rows); // fila 0..rows-1
      const slot = Math.floor(rnd(i*5)*s.cols); // 0..cols-1 (franjas)
      // jitter dentro de la celda
      const jx = (rnd(i*3)-0.5)*(s.cellSize*0.8);
      const jz = (rnd(i*3+2)-0.5)*(s.cellSize*0.8);
      const rx = (ox + slot * (s.cellSize + s.gap)) + jx;
      const rz = (oz + zone * (s.cellSize + s.gap)) + jz;
      // Y = minutos de detención/retraso (0..60) mapeado a 0..3.5 aprox
      const minutes = Math.floor(rnd(i*13)*60);
      const ry = (minutes/60) * 3.5;
      // severidad/eventos ~ tamaño
      const severity = 0.3 + rnd(i*7)*0.7; // 0.3..1.0
      const radius = s.size * (0.6 + severity*1.4);
      // tipo (entrega/incidente)
      const type = rnd(i*17) < 0.7 ? 'delivery' : 'incident';
      const e = document.createElement('a-entity');
      e.setAttribute('position', `${rx} ${ry} ${rz}`);
      e.setAttribute('geometry', `primitive: sphere; radius: ${radius}`);
      const color = s.colorBySlot ? this._slotColor(slot) : '#00d1ff';
      e.setAttribute('material', `color: ${color}; metalness: 0.1; roughness: 0.3; emissive: ${color}; emissiveIntensity: 0.2`);
      e.classList.add('collidable');
      e.dataset.slot = String(slot);
      e.dataset.zone = String(zone);
      e.dataset.intensity = String(severity.toFixed(2));
      e.dataset.minutes = String(minutes);
      e.dataset.type = type;
      e.dataset.metric = 'stops_or_incidents';
      e.addEventListener('mouseenter', ()=>{
        const mean = (agg[zone][slot].count>0 ? (agg[zone][slot].sumMin/agg[zone][slot].count) : 0).toFixed(1);
        const sla = Math.max(0, 100 - Math.max(0, mean-30)*3); // proxy simple
        ttxt.setAttribute('value', `Zona: Z${Number(zone)+1}  |  Franja: ${Number(slot)+1}\nEventos: ${agg[zone][slot].count}  |  T. medio: ${mean} min\nSLA aprox: ${sla}%`);
        tip.setAttribute('position', `${rx} ${ry+0.35} ${rz}`);
        tip.setAttribute('visible', true);
      });
      e.addEventListener('mouseleave', ()=> tip.setAttribute('visible', false));
      root.appendChild(e);
      // agrega a agregador
      const a = agg[zone][slot];
      a.count += 1;
      a.sumMin += minutes;
    }
    
    // Heat-grid (mosaico) por celda, muestran conteo como color y promedio como altura
    const gridRoot = document.createElement('a-entity');
    for (let r=0;r<s.rows;r++){
      for (let c=0;c<s.cols;c++){
        const x = ox + c * (s.cellSize + s.gap);
        const z = oz + r * (s.cellSize + s.gap);
        const a = agg[r][c];
        const count = a.count;
        const mean = a.count>0 ? a.sumMin/a.count : 0;
        const h = Math.min(0.8, mean/60*0.8);
        const plane = document.createElement('a-box');
        plane.setAttribute('position', `${x} ${h/2+0.02} ${z}`);
        plane.setAttribute('geometry', `width: ${s.cellSize*0.9}; depth: ${s.cellSize*0.9}; height: ${h}`);
        plane.setAttribute('material', `color: ${this._countColor(count)}; opacity: 0.95`);
        plane.dataset.zone = String(r);
        plane.dataset.slot = String(c);
        gridRoot.appendChild(plane);
      }
    }
    root.appendChild(gridRoot);

    // Leyenda y ejes
    if (s.showLegend){
      const legend = document.createElement('a-entity');
      legend.setAttribute('position', `${ox + (s.cols*(s.cellSize+s.gap))/2 + 0.8} 1.2 0`);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Leyenda');
      title.setAttribute('color', '#cde3ff');
      title.setAttribute('width', 2);
      title.setAttribute('align', 'center');
      title.setAttribute('position', '0 0.35 0');
      legend.appendChild(title);
      // Colores por franja (1..7)
      for (let i=0;i<7;i++){
        const y = 0.22 - i*0.08;
        const sw = document.createElement('a-plane');
        sw.setAttribute('width','0.08'); sw.setAttribute('height','0.08');
        sw.setAttribute('material', `color: ${this._slotColor(i)}`);
        sw.setAttribute('position', `-0.3 ${y} 0`);
        legend.appendChild(sw);
        const lbl = document.createElement('a-text');
        lbl.setAttribute('value', `Franja ${i+1}`);
        lbl.setAttribute('color', '#9bb3cc');
        lbl.setAttribute('width', 1.5);
        lbl.setAttribute('position', `-0.18 ${y} 0.01`);
        legend.appendChild(lbl);
      }
      const sizeLbl = document.createElement('a-text');
      sizeLbl.setAttribute('value','Tamaño = severidad/eventos');
      sizeLbl.setAttribute('color','#9bb3cc');
      sizeLbl.setAttribute('width',1.6);
      sizeLbl.setAttribute('position','0 -0.4 0.01');
      legend.appendChild(sizeLbl);
      const heightLbl = document.createElement('a-text');
      heightLbl.setAttribute('value','Altura (Y) = 0–60 min');
      heightLbl.setAttribute('color','#9bb3cc');
      heightLbl.setAttribute('width',1.6);
      heightLbl.setAttribute('position','0 -0.52 0.01');
      legend.appendChild(heightLbl);
      root.appendChild(legend);
    }

    if (s.showAxes){
      const mk = (pos, scale) => { const a = document.createElement('a-box'); a.setAttribute('position', pos); a.setAttribute('geometry', `width: ${scale.x}; height: ${scale.y}; depth: ${scale.z}`); a.setAttribute('material','color:#1a2238; opacity:0.95'); return a; };
      root.appendChild(mk({x:0,y:0.01,z:-D/2-0.05},{x: W, y:0.02, z:0.02})); // X
      root.appendChild(mk({x:-W/2-0.05,y:0.01,z:0},{x:0.02,y:0.02,z:D})); // Z
      root.appendChild(mk({x:-W/2-0.2,y:1.2,z:-D/2-0.2},{x:0.02,y:1.2,z:0.02})); // Y ref
      const addLabel=(txt,pos,rot='0 0 0')=>{const t=document.createElement('a-text');t.setAttribute('value',txt);t.setAttribute('color','#cde3ff');t.setAttribute('align','center');t.setAttribute('width',2.2);t.setAttribute('position',pos);t.setAttribute('rotation',rot);return t;};
      root.appendChild(addLabel('Franja horaria (X)',{x:0,y:0.15,z:-D/2-0.45}));
      root.appendChild(addLabel('Zona (Z)',{x:-W/2-0.45,y:0.15,z:0},'0 90 0'));
      root.appendChild(addLabel('Min retraso (Y)',{x:-W/2-0.25,y:1.45,z:-D/2-0.25}));
    }
  },

  play: function(){
    const onFilter = (e)=>{
      const slot = (e && e.detail && typeof e.detail.slot === 'number') ? e.detail.slot : null;
      const zone = (e && e.detail && typeof e.detail.zone === 'number') ? e.detail.zone : null;
      const type = (e && e.detail && e.detail.type) ? e.detail.type : null; // 'delivery' | 'incident'
      const yThreshold = (e && e.detail && typeof e.detail.yThreshold === 'number') ? e.detail.yThreshold : null;
      const children = this.el.children;
      for (let i=0;i<children.length;i++){
        const ch = children[i];
        if (ch && ch.dataset && ch.dataset.slot !== undefined){
          if (slot===null && zone===null && !type && yThreshold===null){ ch.setAttribute('visible', true); continue; }
          const matchSlot = slot===null || Number(ch.dataset.slot) === slot;
          const matchZone = zone===null || Number(ch.dataset.zone) === zone;
          const matchType = !type || ch.dataset.type === type;
          const matchY = yThreshold===null || (Number(ch.object3D.position.y) >= (yThreshold/60)*3.5);
          ch.setAttribute('visible', matchSlot && matchZone && matchType && matchY);
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

  _slotColor: function(idx){
    const colors = ['#00d1ff','#ff7ab6','#ffd166','#8aff80','#ff9f1c','#a29bfe','#2ec4b6'];
    return colors[idx%colors.length];
  }
});
