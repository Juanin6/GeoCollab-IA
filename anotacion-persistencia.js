AFRAME.registerComponent("anotacion-persistencia", {
  init: function () {
    const sceneEl = this.el;
    this.anotacionesKey = "geocollab_anotaciones";
    this.lastHitPoint = null; // guardamos el último punto de intersección
    this.autorVR = "";
    this.vrUIPanel = null;
    this.vrUITextEl = null;
    this.currentViewType = "bars";

    const autorInput = document.createElement("input");
    autorInput.id = "autor-input";
    autorInput.type = "text";
    autorInput.placeholder = "Tu nombre...";
    autorInput.style.position = "fixed";
    autorInput.style.top = "10px";
    autorInput.style.left = "10px";
    autorInput.style.zIndex = "9999";
    autorInput.style.padding = "8px 10px";
    autorInput.style.border = "1px solid #ccc";
    autorInput.style.borderRadius = "6px";
    autorInput.style.background = "rgba(255,255,255,0.9)";
    autorInput.style.color = "#000";
    autorInput.style.fontFamily = "sans-serif";
    autorInput.style.fontSize = "14px";
    if (!document.getElementById("autor-input")) {
      document.body.appendChild(autorInput);
    }

    // Espera a que todo cargue para enganchar eventos con seguridad
    sceneEl.addEventListener("loaded", () => {
      // Cámara que SÍ tiene raycaster
      const cameraEl = sceneEl.querySelector("#rigCamera");
      const chartEl = sceneEl.querySelector("#chart");
      if (chartEl) {
        const initVT = chartEl.getAttribute("data-view-type");
        if (initVT) this.currentViewType = initVT;
        chartEl.addEventListener("view-change", (e) => {
          if (e && e.detail && e.detail.viewType) {
            this.currentViewType = e.detail.viewType;
            this.loadAnotaciones();
          }
        });
      }
      this.loadAnotaciones();

      if (!cameraEl || !cameraEl.components.raycaster) {
        console.warn("No se encontró cámara con raycaster.");
        return;
      }

      const createKey = (label, x, y, w = 0.18) => {
        const key = document.createElement("a-entity");
        key.setAttribute(
          "geometry",
          `primitive: plane; width: ${w}; height: 0.18`
        );
        key.setAttribute("material", "color: #222; opacity: 0.9");
        key.setAttribute("position", `${x} ${y} 0.01`);
        key.setAttribute("class", "vr-author-key");
        key.setAttribute("data-label", label);
        const txt = document.createElement("a-text");
        txt.setAttribute("value", label);
        txt.setAttribute("align", "center");
        txt.setAttribute("color", "#fff");
        txt.setAttribute("width", "1.2");
        txt.setAttribute("position", "0 0 0.01");
        key.appendChild(txt);
        key.addEventListener("mouseenter", () =>
          key.setAttribute("material", "color: #444; opacity: 0.95")
        );
        key.addEventListener("mouseleave", () =>
          key.setAttribute("material", "color: #222; opacity: 0.9")
        );
        key.addEventListener("click", () => {
          const lab = key.getAttribute("data-label");
          if (lab === "Guardar") {
            this.vrUIPanel.setAttribute("visible", false);
            localStorage.setItem("geocollab_autor", this.autorVR || "");
            return;
          }
          if (lab === "Cancelar") {
            this.autorVR = localStorage.getItem("geocollab_autor") || "";
            this.vrUITextEl.setAttribute("value", this.autorVR || "");
            this.vrUIPanel.setAttribute("visible", false);
            return;
          }
          if (lab === "⌫" || lab === "Borrar") {
            this.autorVR = (this.autorVR || "").slice(0, -1);
            this.vrUITextEl.setAttribute("value", this.autorVR);
            return;
          }
          if (lab === "␣") {
            this.autorVR = (this.autorVR || "") + " ";
            this.vrUITextEl.setAttribute("value", this.autorVR);
            return;
          }
          this.autorVR = (this.autorVR || "") + lab;
          this.vrUITextEl.setAttribute("value", this.autorVR);
        });
        return key;
      };

      const buildVRPanel = () => {
        if (this.vrUIPanel) return this.vrUIPanel;
        const panel = document.createElement("a-entity");
        panel.setAttribute("position", "0 1.4 -1.6");
        panel.setAttribute("scale", "0.8 0.8 0.8");
        panel.setAttribute("visible", false);
        const bg = document.createElement("a-entity");
        bg.setAttribute(
          "geometry",
          "primitive: plane; width: 1.4; height: 0.9"
        );
        bg.setAttribute("material", "color: #111; opacity: 0.85");
        panel.appendChild(bg);
        const title = document.createElement("a-text");
        title.setAttribute("value", "Autor");
        title.setAttribute("color", "#fff");
        title.setAttribute("width", "2");
        title.setAttribute("position", "0 0.36 0.01");
        title.setAttribute("align", "center");
        panel.appendChild(title);
        const display = document.createElement("a-entity");
        display.setAttribute(
          "geometry",
          "primitive: plane; width: 1.2; height: 0.18"
        );
        display.setAttribute("material", "color: #000; opacity: 0.9");
        display.setAttribute("position", "0 0.2 0.01");
        const displayText = document.createElement("a-text");
        displayText.setAttribute("value", this.autorVR || "");
        displayText.setAttribute("color", "#0f0");
        displayText.setAttribute("width", "2");
        displayText.setAttribute("position", "-0.58 0 0.02");
        displayText.setAttribute("align", "left");
        display.appendChild(displayText);
        panel.appendChild(display);
        this.vrUITextEl = displayText;
        const rows = [
          "Q W E R T Y U I O P",
          "A S D F G H J K L",
          "Z X C V B N M",
        ];
        let y = 0.0;
        rows.forEach((row, i) => {
          const keys = row.split(" ");
          const rowEntity = document.createElement("a-entity");
          rowEntity.setAttribute("position", `0 ${0.05 - 0.12 * i} 0`);
          const totalW = keys.length * 0.2;
          let startX = -totalW / 2 + 0.1;
          keys.forEach((k, idx) => {
            const key = createKey(k, startX + idx * 0.2, y, 0.18);
            rowEntity.appendChild(key);
          });
          panel.appendChild(rowEntity);
        });
        const actions = document.createElement("a-entity");
        actions.setAttribute("position", "0 -0.28 0");
        // Reubicar: Backspace primero (más a la izquierda), luego espacio, guardar y cancelar
        const backKey = createKey("Borrar", -0.75, 0, 0.32);
        const spaceKey = createKey("␣", -0.35, 0, 0.5);
        const saveKey = createKey("Guardar", 0.05, 0, 0.35);
        const cancelKey = createKey("Cancelar", 0.48, 0, 0.35);
        actions.appendChild(backKey);
        actions.appendChild(spaceKey);
        actions.appendChild(saveKey);
        actions.appendChild(cancelKey);
        panel.appendChild(actions);

        // (Los presets por anotación se mostrarán en un picker contextual, no aquí)
        // Fijar en mundo: adjuntar al sceneEl (no a la cámara)
        sceneEl.appendChild(panel);
        this.vrUIPanel = panel;
        return panel;
      };

      const stored = localStorage.getItem("geocollab_autor") || "";
      if (stored) this.autorVR = stored;
      buildVRPanel();
      // Bloqueo global mientras el puntero está sobre UI
      this._uiBlocking = false;
      const vizPanelEl = sceneEl.querySelector('#vizPanel');
      if (vizPanelEl){
        vizPanelEl.addEventListener('mouseenter', () => { this._uiBlocking = true; });
        vizPanelEl.addEventListener('mouseleave', () => { this._uiBlocking = false; });
      }
      sceneEl.addEventListener("enter-vr", () => {
        const THREE = AFRAME.THREE;
        if (this.vrUIPanel) {
          this.vrUITextEl.setAttribute("value", this.autorVR || "");
          this.vrUIPanel.setAttribute("visible", true);
          // Colocar una sola vez frente al usuario en coordenadas de mundo
          try {
            const rigEl = sceneEl.querySelector('#playerRig');
            const rigPos = new THREE.Vector3();
            const rigQuat = new THREE.Quaternion();
            const forward = new THREE.Vector3(0,0,-1);
            if (rigEl) {
              rigEl.object3D.getWorldPosition(rigPos);
              rigEl.object3D.getWorldQuaternion(rigQuat);
            } else {
              cameraEl.object3D.getWorldPosition(rigPos);
              cameraEl.object3D.getWorldQuaternion(rigQuat);
            }
            forward.applyQuaternion(rigQuat).normalize();
            const target = rigPos.clone().add(forward.multiplyScalar(1.6));
            // Altura segura independiente de la cabeza
            target.y = 1.4;
            this.vrUIPanel.object3D.position.copy(target);
            // Hacer que mire al usuario a la misma altura del panel (sin pitch)
            const head = new THREE.Vector3();
            cameraEl.object3D.getWorldPosition(head);
            const lookAtPoint = new THREE.Vector3(head.x, target.y, head.z);
            this.vrUIPanel.object3D.lookAt(lookAtPoint);
          } catch (e) { /* noop */ }
        }
        const rH = sceneEl.querySelector("#rightHand");
        const lH = sceneEl.querySelector("#leftHand");
        if (rH) {
          rH.setAttribute("visible", true);
          rH.setAttribute("raycaster", "enabled", true);
        }
        if (lH) {
          lH.setAttribute("visible", true);
          lH.setAttribute("raycaster", "enabled", true);
        }
      });
      sceneEl.addEventListener("exit-vr", () => {
        if (this.vrUIPanel) {
          this.vrUIPanel.setAttribute("visible", false);
        }
        const rH = sceneEl.querySelector("#rightHand");
        const lH = sceneEl.querySelector("#leftHand");
        if (rH) {
          rH.setAttribute("raycaster", "enabled", false);
          rH.setAttribute("visible", false);
        }
        if (lH) {
          lH.setAttribute("raycaster", "enabled", false);
          lH.setAttribute("visible", false);
        }
      });

      const isKeyboardEl = (el) => {
        let n = el;
        while (n) {
          if (n === this.vrUIPanel) return true;
          if (n.classList && n.classList.contains("vr-author-key")) return true;
          n = n.parentNode;
        }
        return false;
      };

      const isNoAnnotateEl = (el) => {
        let n = el;
        while (n) {
          if (!n.getAttribute) { n = n.parentNode; continue; }
          const id = n.getAttribute('id') || '';
          if (id === 'vizPanel' || id === 'backBoard') return true;
          if (n.classList) {
            if (n.classList.contains('no-annotate')) return true;
            if (n.classList.contains('ui-panel')) return true;
            if (n.classList.contains('viz-option')) return true;
          }
          n = n.parentNode;
        }
        return false;
      };

      const hasCollidableEl = (el) => {
        let n = el;
        while (n) {
          if (n.classList && n.classList.contains('collidable')) return true;
          n = n.parentNode;
        }
        return false;
      };

      // Creador de un picker contextual de presets (aparece cerca del impacto)
      const showPresetPicker = (worldPos, onPick, onCancel) => {
        const picker = document.createElement('a-entity');
        picker.setAttribute('class','no-annotate');
        const bg = document.createElement('a-entity');
        bg.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.32');
        bg.setAttribute('material','color: #0f172a; opacity: 0.96; side: double');
        picker.appendChild(bg);
        const makeBtn = (label, x) => {
          const b = document.createElement('a-entity');
          b.setAttribute('class','no-annotate viz-option');
          b.setAttribute('geometry','primitive: plane; width: 0.26; height: 0.12');
          b.setAttribute('material','color: #1a2238; opacity: 0.98; side: double');
          b.setAttribute('position',`${x} 0 0.01`);
          const t = document.createElement('a-text');
          t.setAttribute('value', label);
          t.setAttribute('color','#e2f3ff');
          t.setAttribute('align','center');
          t.setAttribute('width','1.2');
          t.setAttribute('position','0 0 0.01');
          b.appendChild(t);
          b.addEventListener('click', ()=>{ onPick && onPick(label); picker.remove(); });
          b.addEventListener('mouseenter', ()=> b.setAttribute('material','color:#243047; opacity:1'));
          b.addEventListener('mouseleave', ()=> b.setAttribute('material','color:#1a2238; opacity:0.98'));
          return b;
        };
        picker.appendChild(makeBtn('Revisar SLA', -0.3));
        picker.appendChild(makeBtn('Demanda alta', 0));
        picker.appendChild(makeBtn('Anomalía', 0.3));
        // Pegar al cuerpo: adjuntar al rigCamera y colocar en espacio local frente al usuario
        try {
          const cam = sceneEl.querySelector('#rigCamera');
          if (cam) {
            cam.appendChild(picker);
            picker.setAttribute('position', '0 -0.15 -0.8');
            picker.setAttribute('rotation', '0 0 0');
          } else {
            sceneEl.appendChild(picker);
            picker.setAttribute('position', `${worldPos.x} ${Math.max(worldPos.y + 0.4, 1.1)} ${worldPos.z}`);
          }
        } catch(e) { sceneEl.appendChild(picker); }
        return picker;
      };

      const handleTriggerDown = (ctrlEl) => (e) => {
        const rc = ctrlEl.components && ctrlEl.components.raycaster;
        const hit = (rc && rc.intersections && rc.intersections[0]) || null;
        const point = hit && hit.point ? hit.point : null;
        const targetEl =
          hit && hit.object && hit.object.el ? hit.object.el : null;
        if (!point) return;
        if (this._uiBlocking) return;
        if (targetEl && (isKeyboardEl(targetEl) || isNoAnnotateEl(targetEl))) return;
        if (!targetEl || !hasCollidableEl(targetEl)) return;
        const chartElNow2 = sceneEl.querySelector("#chart");
        if (
          chartElNow2 &&
          chartElNow2.components &&
          chartElNow2.components["terrain-wire"] &&
          typeof chartElNow2.components["terrain-wire"].getHeightAtWorld ===
            "function"
        ) {
          const h = chartElNow2.components["terrain-wire"].getHeightAtWorld(
            point.x,
            point.z
          );
          point.y = h;
        }
        const nombreEl = document.getElementById("autor-input");
        const nombre = nombreEl && nombreEl.value ? nombreEl.value.trim() : "";
        const autorFinal =
          (this.autorVR && this.autorVR.trim()) || nombre || "Anónimo";
        const vtNow2 =
          (chartElNow2 && chartElNow2.getAttribute("data-view-type")) ||
          this.currentViewType ||
          "bars";
        // Contexto desde dataset del objetivo
        let contexto = "";
        if (targetEl && targetEl.dataset) {
          const ds = targetEl.dataset;
          const parts = [];
          if (ds.metric) parts.push(`metric: ${ds.metric}`);
          if (ds.zone !== undefined) parts.push(`zona: ${ds.zone}`);
          if (ds.slot !== undefined) parts.push(`franja: ${ds.slot}`);
          if (ds.value !== undefined) parts.push(`valor: ${ds.value}`);
          if (parts.length) contexto = ` [${parts.join(" | ")}]`;
        }
        showPresetPicker(point, (label)=>{
          const newAnotacion = {
            id: Date.now(),
            autor: autorFinal,
            texto: `${label}${contexto}`,
            posicion: [point.x, point.y, point.z],
            rotacion: [0, 0, 0],
            view_type: vtNow2,
          };
          this.saveAnotacion(newAnotacion);
        });
      };

      const rightHand = sceneEl.querySelector("#rightHand");
      const leftHand = sceneEl.querySelector("#leftHand");
      if (rightHand) {
        rightHand.setAttribute("visible", false);
        rightHand.setAttribute("raycaster", "enabled", false);
        rightHand.addEventListener("triggerdown", handleTriggerDown(rightHand));
      }
      if (leftHand) {
        leftHand.setAttribute("visible", false);
        leftHand.setAttribute("raycaster", "enabled", false);
        leftHand.addEventListener("triggerdown", handleTriggerDown(leftHand));
      }

      // Actualiza el último punto de impacto cuando el rayo intersecta algo
      cameraEl.addEventListener("raycaster-intersection", (e) => {
        // Tomamos la intersección más cercana
        const first = e.detail.intersections && e.detail.intersections[0];
        const targetEl = first && first.object && first.object.el ? first.object.el : null;
        if (targetEl && (isKeyboardEl(targetEl) || isNoAnnotateEl(targetEl) || !hasCollidableEl(targetEl))) {
          this.lastHitPoint = null;
          return;
        }
        this.lastHitPoint = first ? first.point : null;
      });

      // Si se deja de apuntar a algo, limpiamos
      cameraEl.addEventListener("raycaster-intersection-cleared", () => {
        this.lastHitPoint = null;
      });

      // Botón: guarda usando el último punto de impacto conocido
      const btn = document.getElementById("guardar-btn");
      btn.addEventListener("click", () => {
        // Alternativa robusta: si no tenemos lastHitPoint por eventos,
        // intentamos leer las intersecciones actuales del componente
        const r = cameraEl.components.raycaster;
        const hit = (r && r.intersections && r.intersections[0]) || null;
        const point = this.lastHitPoint || (hit ? hit.point : null);
        const targetEl = hit && hit.object && hit.object.el ? hit.object.el : null;

        if (!point) {
          console.log(
            "No hay objeto apuntado. Apunta un objeto con clase 'collidable'."
          );
          return;
        }
        if (this._uiBlocking) return;
        if (targetEl && (isKeyboardEl(targetEl) || isNoAnnotateEl(targetEl))) {
          return;
        }
        if (!targetEl || !hasCollidableEl(targetEl)) return;
        if (!this.notePreset) {
          console.log('Selecciona un preset de texto en el panel antes de anotar.');
          return;
        }

        const chartElNow = sceneEl.querySelector("#chart");
        if (
          chartElNow &&
          chartElNow.components &&
          chartElNow.components["terrain-wire"] &&
          typeof chartElNow.components["terrain-wire"].getHeightAtWorld ===
            "function"
        ) {
          const h = chartElNow.components["terrain-wire"].getHeightAtWorld(
            point.x,
            point.z
          );
          point.y = h;
        }
        const nombreEl = document.getElementById("autor-input");
        const nombre = nombreEl && nombreEl.value ? nombreEl.value.trim() : "";
        const autorFinal =
          (this.autorVR && this.autorVR.trim()) || nombre || "Anónimo";
        const vtNow =
          (chartElNow && chartElNow.getAttribute("data-view-type")) ||
          this.currentViewType ||
          "bars";

        let contexto2 = "";
        if (targetEl && targetEl.dataset) {
          const ds = targetEl.dataset;
          const parts = [];
          if (ds.metric) parts.push(`metric: ${ds.metric}`);
          if (ds.zone !== undefined) parts.push(`zona: ${ds.zone}`);
          if (ds.slot !== undefined) parts.push(`franja: ${ds.slot}`);
          if (ds.value !== undefined) parts.push(`valor: ${ds.value}`);
          if (parts.length) contexto2 = ` [${parts.join(" | ")}]`;
        }
        showPresetPicker(point, (label)=>{
          const newAnotacion = {
            id: Date.now(),
            autor: autorFinal,
            texto: `${label}${contexto2}`,
            posicion: [point.x, point.y, point.z],
            rotacion: [0, 0, 0],
            view_type: vtNow,
          };
          this.saveAnotacion(newAnotacion);
        });
      });
    });
  },

  saveAnotacion: async function (anotacion) {
    try {
      await fetch("anotaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anotacion),
      });
      console.log("Anotación guardada:", anotacion);
      this.loadAnotaciones();
    } catch (e) {
      console.error("Error guardando anotación:", e);
    }
  },

  loadAnotaciones: async function () {
    const sceneEl = this.el;

    sceneEl
      .querySelectorAll(".persisted-anotacion")
      .forEach((el) => el.remove());

    try {
      const vt = this.currentViewType || "bars";
      const res = await fetch(
        `anotaciones?view_type=${encodeURIComponent(vt)}`
      );
      const anotaciones = await res.json();

      anotaciones.forEach((anotacion) => {
        const markerEl = document.createElement("a-entity");

        const pos = Array.isArray(anotacion.posicion)
          ? anotacion.posicion
          : (anotacion.posicion && anotacion.posicion.coordinates) ||
            anotacion.posicion || [0, 0, 0];
        const rot = Array.isArray(anotacion.rotacion)
          ? anotacion.rotacion
          : anotacion.rotacion || [0, 0, 0];

        markerEl.setAttribute("position", pos.join(" "));
        markerEl.setAttribute("rotation", rot.join(" "));
        markerEl.setAttribute("class", "persisted-anotacion collidable");

        markerEl.setAttribute("geometry", "primitive: sphere; radius: 0.1");
        markerEl.setAttribute("material", "color: #00FF00");

        const safeTexto = `${anotacion.autor}: ${anotacion.texto}`.replace(
          /[\n\r]/g,
          " "
        );
        const label = document.createElement('a-text');
        label.setAttribute('value', safeTexto);
        label.setAttribute('position', '0 0.3 0');
        label.setAttribute('width', '2');
        label.setAttribute('color', '#FFFFFF');
        label.setAttribute('wrap-count', '20');
        label.setAttribute('visible', 'false');
        markerEl.appendChild(label);

        const show = () => label.setAttribute('visible', true);
        const hide = () => label.setAttribute('visible', false);
        markerEl.addEventListener('mouseenter', show);
        markerEl.addEventListener('mouseleave', hide);
        markerEl.addEventListener('raycaster-intersected', show);
        markerEl.addEventListener('raycaster-intersected-cleared', hide);

        sceneEl.appendChild(markerEl);
      });

      console.log(`Cargadas ${anotaciones.length} anotaciones persistentes.`);
    } catch (e) {
      console.error("Error cargando anotaciones:", e);
    }
  },
});
//localStorage.removeItem("geocollab_anotaciones");
