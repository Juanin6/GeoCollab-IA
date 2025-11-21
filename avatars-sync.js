AFRAME.registerComponent('avatars-sync', {
  schema: {
    color: { type: 'string', default: '#7dd3fc' },
    height: { type: 'number', default: 1.7 },
    radius: { type: 'number', default: 0.18 },
    updateHz: { type: 'number', default: 10 },
    modelUrl: { type: 'string', default: '' },
    modelScale: { type: 'vec3', default: { x: 1, y: 1, z: 1 } },
    modelYOffset: { type: 'number', default: 0 }
  },
  init: function(){
    const sceneEl = this.el.sceneEl;
    const ioClient = window.io ? window.io : null;
    if (!ioClient){
      console.warn('[avatars-sync] socket.io client not found');
      return;
    }
    this.socket = ioClient();
    this.avatars = {}; // id -> entity
    this._tickInt = null;

    // Helpers
    const makeAvatar = (id, name, color, h, r) => {
      const root = document.createElement('a-entity');
      root.setAttribute('class', 'remote-avatar');
      root.setAttribute('data-id', id);

      if (this.data.modelUrl) {
        // Humanoid GLB
        const model = document.createElement('a-entity');
        model.setAttribute('gltf-model', this.data.modelUrl);
        model.setAttribute('scale', `${this.data.modelScale.x} ${this.data.modelScale.y} ${this.data.modelScale.z}`);
        model.setAttribute('position', `0 ${this.data.modelYOffset} 0`);
        model.setAttribute('animation-mixer', '');
        root.appendChild(model);
      } else {
        // Fallback: cápsula simple (cilindro + esfera)
        const body = document.createElement('a-cylinder');
        body.setAttribute('radius', r);
        body.setAttribute('height', Math.max(0.6, h * 0.5));
        body.setAttribute('material', `color: ${color}; opacity: 0.85`);
        body.setAttribute('position', `0 ${Number(body.getAttribute('height'))/2} 0`);
        root.appendChild(body);

        const head = document.createElement('a-sphere');
        head.setAttribute('radius', r * 0.7);
        head.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.2`);
        head.setAttribute('position', `0 ${Number(body.getAttribute('height'))} 0`);
        root.appendChild(head);
      }

      // Name tag
      const tag = document.createElement('a-text');
      tag.setAttribute('value', name || 'Usuario');
      tag.setAttribute('color', '#ffffff');
      tag.setAttribute('width', 2);
      tag.setAttribute('align', 'center');
      tag.setAttribute('position', `0 ${Math.max(1.4, h)} 0.01`);
      root.appendChild(tag);

      // Make collidable for raycaster visibility if needed
      root.classList.add('collidable');

      sceneEl.appendChild(root);
      return root;
    };

    const upsertAvatar = (id, payload) => {
      const name = payload && payload.name ? payload.name : 'Usuario';
      const pos = payload && payload.pos ? payload.pos : [0,0,0];
      const rot = payload && payload.rot ? payload.rot : [0,0,0];
      let ent = this.avatars[id];
      if (!ent){
        ent = makeAvatar(id, name, this.data.color, this.data.height, this.data.radius);
        this.avatars[id] = ent;
      }
      ent.object3D.position.set(pos[0], pos[1], pos[2]);
      ent.object3D.rotation.set(THREE.MathUtils.degToRad(rot[0]||0), THREE.MathUtils.degToRad(rot[1]||0), THREE.MathUtils.degToRad(rot[2]||0));
    };

    // Socket events
    this.socket.on('connect', () => {
      // announce self join to others implicitly via server broadcast
    });
    this.socket.on('avatar:join', ({id}) => {
      // placeholder: we will create on first update
    });
    this.socket.on('avatar:update', (payload) => {
      const { id } = payload;
      if (!id || id === this.socket.id) return;
      upsertAvatar(id, payload);
    });
    this.socket.on('avatar:leave', ({id}) => {
      const ent = this.avatars[id];
      if (ent && ent.parentNode) ent.parentNode.removeChild(ent);
      delete this.avatars[id];
    });

    // Periodically send our own pose
    const getLocalPose = () => {
      const camEl = sceneEl.querySelector('#rigCamera') || (sceneEl.camera && sceneEl.camera.el);
      if (!camEl) return null;
      const p = camEl.object3D.getWorldPosition(new THREE.Vector3());
      const e = new THREE.Euler().setFromQuaternion(camEl.object3D.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
      const deg = [THREE.MathUtils.radToDeg(e.x), THREE.MathUtils.radToDeg(e.y), THREE.MathUtils.radToDeg(e.z)];
      // Keep Y a bit lower to match avatar base height
      return { pos: [p.x, Math.max(0, p.y - 1.6), p.z], rot: deg };
    };

    const getName = () => {
      const el = document.getElementById('autor-input');
      const v = el && el.value ? el.value.trim() : '';
      return v || 'Anónimo';
    };

    const sendUpdate = () => {
      const pose = getLocalPose();
      if (!pose || !this.socket) return;
      this.socket.emit('avatar:update', { ...pose, name: getName() });
    };

    const interval = Math.max(1, Math.floor(1000/this.data.updateHz));
    this._tickInt = setInterval(sendUpdate, interval);
  },
  remove: function(){
    if (this._tickInt) { clearInterval(this._tickInt); this._tickInt = null; }
    if (this.socket) { try { this.socket.disconnect(); } catch(e){} }
    Object.values(this.avatars || {}).forEach(ent => { if (ent && ent.parentNode) ent.parentNode.removeChild(ent); });
    this.avatars = {};
  }
});
