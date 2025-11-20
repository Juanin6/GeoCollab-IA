AFRAME.registerComponent("terrain-wire", {
  schema: {
    rows: { type: "int", default: 80 },
    cols: { type: "int", default: 80 },
    size: { type: "number", default: 8 },
    height: { type: "number", default: 2.5 },
    seed: { type: "number", default: 1 },
    linesBothAxes: { type: "boolean", default: true },
    yOffset: { type: "number", default: 0 },

    // === Enfoque A (nuevos) ===
    slopeMax: { type: "number", default: 0.4 }, // 0.40 = 40% (rojo)
    slopeThreshold: { type: "number", default: 0.25 }, // crítico ≥ 25%
    colorLow: { type: "color", default: "#2ecc71" }, // verde (pendiente baja)
    colorMid: { type: "color", default: "#f1c40f" }, // amarillo (media)
    colorHigh: { type: "color", default: "#e74c3c" }, // rojo  (pendiente alta)
    onlyCritical: { type: "boolean", default: false },
    nonCriticalOpacity: { type: "number", default: 0.28 },
    criticalOpacity: { type: "number", default: 1.0 },
  },

  init: function () {
    const el = this.el,
      d = this.data,
      THREE = AFRAME.THREE;

    const rnd2 = (x, y) => {
      const v =
        Math.sin((x + d.seed * 7.12) * 12.9898 + (y + d.seed * 3.33) * 78.233) *
        43758.5453;
      return v - Math.floor(v);
    };
    
    const smoothNoise = (x, y) => {
      const ix = Math.floor(x),
        fx = x - ix;
      const iy = Math.floor(y),
        fy = y - iy;
      const n00 = rnd2(ix, iy),
        n10 = rnd2(ix + 1, iy),
        n01 = rnd2(ix, iy + 1),
        n11 = rnd2(ix + 1, iy + 1);
      const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
      const nx0 = lerp(n00, n10, fx);
      const nx1 = lerp(n01, n11, fx);
      return lerp(nx0, nx1, fy);
    };
    const heightAt = (x, y) => {
      const f1 = smoothNoise(x * 0.15, y * 0.15);
      const f2 = smoothNoise(x * 0.05 + 50, y * 0.05 + 50);
      return (0.6 * f1 + 0.4 * f2) * d.height;
    };

    const w = d.size,
      h = d.size;
    const dx = w / (d.cols - 1);
    const dz = h / (d.rows - 1);
    const x0 = -w / 2,
      z0 = -h / 2;

    const positionsCritical = [],
      colorsCritical = [];
    const positionsNon = [],
      colorsNon = [];

    const hexToRgbN = (hex) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return [
        parseInt(m[1], 16) / 255,
        parseInt(m[2], 16) / 255,
        parseInt(m[3], 16) / 255,
      ];
    };
    const cLo = hexToRgbN(d.colorLow),
      cMi = hexToRgbN(d.colorMid),
      cHi = hexToRgbN(d.colorHigh);
    const lerp = (a, b, t) => a + (b - a) * t;
    const rampColor = (t) => {
      const tt = Math.max(0, Math.min(1, t));
      if (tt <= 0.5) {
        const k = tt * 2.0;
        return [lerp(cLo[0], cMi[0], k), lerp(cLo[1], cMi[1], k), lerp(cLo[2], cMi[2], k)];
      } else {
        const k = (tt - 0.5) * 2.0;
        return [lerp(cMi[0], cHi[0], k), lerp(cMi[1], cHi[1], k), lerp(cMi[2], cHi[2], k)];
      }
    };

    const pushSegmentTo = (arrPos, arrCol, ax, ay, az, bx, by, bz, tColor) => {
      const col = rampColor(tColor);
      arrPos.push(ax, ay, az, bx, by, bz);
      arrCol.push(col[0], col[1], col[2], col[0], col[1], col[2]);
    };

    // Líneas a lo largo de X (distancia horizontal ~ dx)
    for (let r = 0; r < d.rows; r++) {
      const z = z0 + r * dz;
      for (let c = 0; c < d.cols - 1; c++) {
        const x1 = x0 + c * dx,
          x2 = x0 + (c + 1) * dx;
        const y1 = heightAt(c, r),
          y2 = heightAt(c + 1, r);
        const slope = Math.abs(y2 - y1) / Math.max(dx, 1e-6);
        const tColor = Math.min(slope / d.slopeMax, 1.0);
        const isCritical = slope >= d.slopeThreshold;
        if (d.onlyCritical) {
          if (isCritical) pushSegmentTo(positionsCritical, colorsCritical, x1, y1, z, x2, y2, z, tColor);
        } else {
          if (isCritical) pushSegmentTo(positionsCritical, colorsCritical, x1, y1, z, x2, y2, z, tColor);
          else pushSegmentTo(positionsNon, colorsNon, x1, y1, z, x2, y2, z, tColor);
        }
      }
    }

    // Líneas a lo largo de Z (distancia horizontal ~ dz)
    if (d.linesBothAxes) {
      for (let c = 0; c < d.cols; c++) {
        const x = x0 + c * dx;
        for (let r = 0; r < d.rows - 1; r++) {
          const z1 = z0 + r * dz,
            z2 = z0 + (r + 1) * dz;
          const y1 = heightAt(c, r),
            y2 = heightAt(c, r + 1);
          const slope = Math.abs(y2 - y1) / Math.max(dz, 1e-6);
          const tColor = Math.min(slope / d.slopeMax, 1.0);
          const isCritical = slope >= d.slopeThreshold;
          if (d.onlyCritical) {
            if (isCritical) pushSegmentTo(positionsCritical, colorsCritical, x, y1, z1, x, y2, z2, tColor);
          } else {
            if (isCritical) pushSegmentTo(positionsCritical, colorsCritical, x, y1, z1, x, y2, z2, tColor);
            else pushSegmentTo(positionsNon, colorsNon, x, y1, z1, x, y2, z2, tColor);
          }
        }
      }
    }

    const wrapper = new THREE.Group();
    wrapper.position.y = d.yOffset || 0;

    if (positionsNon.length) {
      const geomNon = new THREE.BufferGeometry();
      geomNon.setAttribute("position", new THREE.Float32BufferAttribute(positionsNon, 3));
      geomNon.setAttribute("color", new THREE.Float32BufferAttribute(colorsNon, 3));
      const matNon = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: d.nonCriticalOpacity });
      wrapper.add(new THREE.LineSegments(geomNon, matNon));
    }
    if (positionsCritical.length) {
      const geomCrit = new THREE.BufferGeometry();
      geomCrit.setAttribute("position", new THREE.Float32BufferAttribute(positionsCritical, 3));
      geomCrit.setAttribute("color", new THREE.Float32BufferAttribute(colorsCritical, 3));
      const matCrit = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: d.criticalOpacity });
      wrapper.add(new THREE.LineSegments(geomCrit, matCrit));
    }
    el.setObject3D("mesh", wrapper);

    // sigue igual
    this.getHeightAtWorld = (wx, wz) => {
      const inv = new THREE.Matrix4();
      const wp = new THREE.Vector3(wx, 0, wz);
      inv.copy(el.object3D.matrixWorld).invert();
      wp.applyMatrix4(inv);
      const lx = wp.x,
        lz = wp.z;
      const cx = (lx - x0) / dx,
        rz = (lz - z0) / dz;
      return heightAt(cx, rz);
    };
  },
});
