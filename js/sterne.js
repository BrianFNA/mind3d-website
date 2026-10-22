// background.js – effizienter, animierter Weltraum-Hintergrund.
//
// Läuft auf einem EIGENEN Canvas mit eigener, gedrosselter Loop (~30 fps),
// entkoppelt vom Vordergrund (Knoten). Sterne werden als vorgerendertes
// Sprite per drawImage in mehreren Parallax-Ebenen gezeichnet (statt teurer
// arc()-Fills pro Stern). Ebenen driften sanft und reagieren dezent auf
// Pan/Zoom der Mindmap. Wenige Sterne twinkeln, selten zieht ein Meteor
// durch. Dezenter Nebel + Vignette als einmalig vorgerenderte Kulisse.
// Pausiert automatisch, wenn die Seite nicht sichtbar ist.

class SpaceBackground {
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext("2d");
    this.viewport = null;            // optional {panX,panY,zoom} für Pan-Reaktion

    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr  = 1;

    this._layers   = [];
    this._sprites  = {};
    this._backdrop = null;
    this._meteor   = null;           // max. 1 gleichzeitig
    this._nextMeteor = this._meteorDelay();

    this._running = false;
    this._raf     = null;
    this._lastT   = 0;
    this._acc     = 0;
    this._frameInterval = 1000 / 30; // ~30 fps

    this._lastPan  = { x: 0, y: 0 };
    this._viewInit = false;

    this._buildSprites();
    this.resize(this.cssW, this.cssH, 1);

    this._onVisibility = () => { document.hidden ? this.stop() : this.start(); };
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  // ── Vorgerenderte Ressourcen ─────────────────────────────────
  _buildSprites() {
    const make = (r, g, b) => {
      const s = 32;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const cx = c.getContext("2d");
      const grd = cx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
      grd.addColorStop(0.0, `rgba(${r},${g},${b},1)`);
      grd.addColorStop(0.35, `rgba(${r},${g},${b},0.5)`);
      grd.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
      cx.fillStyle = grd;
      cx.fillRect(0, 0, s, s);
      return c;
    };
    this._sprites = {
      white: make(255, 255, 255),
      blue:  make(185, 212, 255),
      warm:  make(255, 220, 180),
    };
  }

  _meteorDelay() { return 16000 + Math.random() * 19000; } // 16–35 s (selten)

  // Ebenen: fern (viele, klein, langsam, kaum Parallax) … nah (wenige, groß)
  _buildLayers() {
    const area = this.cssW * this.cssH;
    const base = Math.max(120, Math.min(300, Math.round(area / 6800))); // "mittel", adaptiv
    const defs = [
      { frac: 0.55, size: [0.6, 1.2], alpha: [0.22, 0.5], drift: 5,  parallax: 0.02, twinkle: 0.05 },
      { frac: 0.30, size: [1.0, 1.8], alpha: [0.4, 0.78], drift: 11, parallax: 0.06, twinkle: 0.18 },
      { frac: 0.15, size: [1.5, 2.7], alpha: [0.55, 1.0], drift: 18, parallax: 0.13, twinkle: 0.35 },
    ];
    this._layers = defs.map(d => {
      const count = Math.round(base * d.frac);
      const stars = [];
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const spr  = roll < 0.07 ? "warm" : roll < 0.28 ? "blue" : "white";
        stars.push({
          x: Math.random() * this.cssW,
          y: Math.random() * this.cssH,
          size:  d.size[0]  + Math.random() * (d.size[1]  - d.size[0]),
          alpha: d.alpha[0] + Math.random() * (d.alpha[1] - d.alpha[0]),
          twinkle: Math.random() < d.twinkle,
          phase: Math.random() * Math.PI * 2,
          tw:    0.6 + Math.random() * 0.9,
          spr,
        });
      }
      // sanfte Grunddrift, grob nach links (leicht variiert)
      const ang = Math.PI + (-0.3 + Math.random() * 0.6);
      return {
        stars,
        driftX: Math.cos(ang) * d.drift,
        driftY: Math.sin(ang) * d.drift * 0.4,
        parallax: d.parallax,
      };
    });
  }

  _buildBackdrop() {
    const w = this.cssW, h = this.cssH;
    const c = document.createElement("canvas");
    c.width  = Math.max(1, Math.round(w * this.dpr));
    c.height = Math.max(1, Math.round(h * this.dpr));
    const cx = c.getContext("2d");
    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    let g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#080a18");
    g.addColorStop(1, "#04050c");
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);

    // Nebelflecken (sehr dezent) – "mittel"
    const nebula = (x, y, r, col) => {
      const rg = cx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      cx.fillStyle = rg;
      cx.fillRect(0, 0, w, h);
    };
    const R = Math.max(w, h);
    nebula(w * 0.24, h * 0.28, R * 0.55, "rgba(40,64,120,0.10)");
    nebula(w * 0.82, h * 0.72, R * 0.48, "rgba(88,50,112,0.08)");

    // Vignette
    const vg = cx.createRadialGradient(w/2, h/2, Math.min(w, h) * 0.35, w/2, h/2, R * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    cx.fillStyle = vg;
    cx.fillRect(0, 0, w, h);

    this._backdrop = c;
  }

  // ── Größe (Hintergrund darf gröber sein → DPR gedeckelt) ─────
  resize(cssW, cssH, dpr) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr  = Math.max(1, Math.min(dpr || 1, 1.5));
    this.canvas.width  = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width  = this.cssW + "px";
    this.canvas.style.height = this.cssH + "px";
    this._buildLayers();
    this._buildBackdrop();
  }

  // ── Steuerung ────────────────────────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    this._lastT = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const loop = (t) => {
      if (!this._running) return;
      const now = t || (typeof performance !== "undefined" ? performance.now() : Date.now());
      const dt  = Math.min(64, now - this._lastT);
      this._lastT = now;
      this._acc += dt;
      if (this._acc >= this._frameInterval) {
        this._update(this._acc / 1000);
        this._acc = 0;
        this._render();
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // ── Update ───────────────────────────────────────────────────
  _update(dt) {
    // Pan-Reaktion: Differenz zur letzten Mindmap-View
    let dpx = 0, dpy = 0;
    if (this.viewport) {
      const px = this.viewport.panX || 0, py = this.viewport.panY || 0;
      if (this._viewInit) { dpx = px - this._lastPan.x; dpy = py - this._lastPan.y; }
      this._lastPan.x = px; this._lastPan.y = py; this._viewInit = true;
    }

    const W = this.cssW, H = this.cssH;
    for (const layer of this._layers) {
      const dx = layer.driftX * dt + dpx * layer.parallax;
      const dy = layer.driftY * dt + dpy * layer.parallax;
      for (const s of layer.stars) {
        s.x += dx; s.y += dy;
        if (s.x < -4) s.x += W + 8; else if (s.x > W + 4) s.x -= W + 8;
        if (s.y < -4) s.y += H + 8; else if (s.y > H + 4) s.y -= H + 8;
        if (s.twinkle) s.phase += dt * s.tw;
      }
    }

    // Meteore (selten, max. 1)
    this._nextMeteor -= dt * 1000;
    if (!this._meteor && this._nextMeteor <= 0) {
      this._spawnMeteor();
      this._nextMeteor = this._meteorDelay();
    }
    if (this._meteor) {
      const m = this._meteor;
      m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
      if (m.life >= m.maxLife || m.x > W + 90 || m.x < -90 || m.y > H + 90) {
        this._meteor = null;
      }
    }
  }

  _spawnMeteor() {
    const W = this.cssW;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? Math.random() * W * 0.4 : W * 0.6 + Math.random() * W * 0.4;
    const startY = -20 - Math.random() * 40;
    const speed  = 520 + Math.random() * 260;
    const ang    = (fromLeft ? 0.9 : Math.PI - 0.9) + (-0.15 + Math.random() * 0.3);
    this._meteor = {
      x: startX, y: startY,
      vx: Math.cos(ang) * speed,
      vy: Math.abs(Math.sin(ang)) * speed,
      len: 90 + Math.random() * 70,
      life: 0, maxLife: 1.1 + Math.random() * 0.6,
    };
  }

  // ── Render ───────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.cssW, H = this.cssH;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (this._backdrop) ctx.drawImage(this._backdrop, 0, 0, W, H);
    else { ctx.fillStyle = "#05060f"; ctx.fillRect(0, 0, W, H); }

    // additiver Glow für Sterne/Meteore
    ctx.globalCompositeOperation = "lighter";
    for (const layer of this._layers) {
      for (const s of layer.stars) {
        let a = s.alpha;
        if (s.twinkle) a *= 0.55 + 0.45 * Math.sin(s.phase);
        if (a <= 0.02) continue;
        const spr = this._sprites[s.spr] || this._sprites.white;
        const d = s.size * 3.2;
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d);
      }
    }
    if (this._meteor) this._drawMeteor(ctx);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  _drawMeteor(ctx) {
    const m = this._meteor;
    const mag = Math.hypot(m.vx, m.vy) || 1;
    const ux = m.vx / mag, uy = m.vy / mag;
    const tailX = m.x - ux * m.len, tailY = m.y - uy * m.len;
    const p = m.life / m.maxLife;
    const fade = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI); // 0→1→0

    const g = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
    g.addColorStop(0.0, `rgba(255,255,255,${0.9 * fade})`);
    g.addColorStop(0.3, `rgba(200,225,255,${0.5 * fade})`);
    g.addColorStop(1.0, "rgba(160,200,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.globalAlpha = fade;
    ctx.drawImage(this._sprites.white, m.x - 6, m.y - 6, 12, 12);
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this._onVisibility);
  }
}
