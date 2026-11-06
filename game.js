(() => {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const toast = document.getElementById('toast');
  const panel = document.getElementById('job-panel');
  const peopleList = document.getElementById('people-list');
  let W = 0, H = 0, dpr = 1, live = false, scene = 'village', last = 0, toastTimer;
  const safe = { t: 0, b: 0, l: 0, r: 0 };
  const held = {};
  let pointer = null;

  const state = {
    coins: 0,
    hero: { x: 0, y: 0, hp: 5, max: 5, dir: 1, invuln: 0, attack: 0, step: 0 },
    people: [],
    treeCharges: [3, 3, 3, 3],
    treeRespawn: 0,
    campTimer: 0,
    key: false,
    slimes: [],
    shots: [],
    boss: { x: 0, y: 0, hp: 9, max: 9, awake: false, attack: 0, fire: 0 },
    floaters: [],
    won: false,
    time: 0,
  };
  const trees = [
    { x: 0.11, y: 0.26, big: 1.62 },
    { x: 0.22, y: 0.55, big: 1.32 },
    { x: 0.89, y: 0.27, big: 1.42 },
    { x: 0.10, y: 0.68, big: 1.26 },
  ];
  const names = ['Mira', 'Rowan', 'Tamsin'];
  const icons = ['🧑🏻‍🌾', '🧑🏽‍🦱', '🧑🏼‍🦰'];
  const jobInfo = {
    Archer: 'Fires an arrow at the nearest foe every few seconds.',
    Swordsman: 'Adds bite to every sword strike.',
    Builder: 'Mends a heart and raises your maximum.',
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const viewScale = () => W > H ? clamp(Math.min(W, H) / 560, 1, 1.4) : clamp(H / 820, 0.74, 1.4);
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const css = getComputedStyle(document.documentElement);
    safe.t = parseFloat(css.getPropertyValue('--sat')) || 0;
    safe.b = parseFloat(css.getPropertyValue('--sab')) || 0;
    safe.l = parseFloat(css.getPropertyValue('--sal')) || 0;
    safe.r = parseFloat(css.getPropertyValue('--sar')) || 0;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.hero.x) { state.hero.x = W * 0.45; state.hero.y = H * 0.7; }
    if (scene === 'dungeon') placeDungeon();
  }

  function playfield() { return { top: 92 + safe.t, bottom: H - 118 - safe.b, left: 12 + safe.l, right: W - 12 - safe.r }; }
  function village() {
    const p = playfield();
    return {
      p,
      gate: { x: W * 0.5, y: p.top + (W > H ? 68 : 75) },
      cabin: { x: W * (W > H ? 0.345 : 0.44), y: p.top + (p.bottom - p.top) * (W > H ? 0.54 : 0.47) },
      camp: { x: W * 0.78, y: p.top + (p.bottom - p.top) * 0.68 },
      hero: state.hero,
    };
  }
  function keyPos() {
    const p = playfield(), top = p.top + 10, bot = p.bottom - 14;
    return { x: W * 0.28, y: top + (bot - top) * 0.58 };
  }

  function placeDungeon() {
    const p = playfield();
    state.boss.x = W * 0.5;
    state.boss.y = p.top + 132;
  }

  function toastMsg(s) {
    toast.textContent = s;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }
  function floatText(x, y, s, color = '#ffe39a') { state.floaters.push({ x, y, s, color, life: 1.1 }); }

  function rounded(x, y, w, h, r, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(s, x, y, size, color = '#f7edce', align = 'left', weight = 700, family = '"DM Sans", sans-serif') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  const serif = '"MedievalSharp", Georgia, serif';

  /* ---------------- world drawing ---------------- */

  function drawGrass(t) {
    ctx.fillStyle = '#5a7a4a';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.6, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(190,205,130,.18)');
    g.addColorStop(1, 'rgba(20,45,30,.34)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 150; i++) {
      const x = ((i * 167 + 31) % 997) / 997 * W;
      const y = ((i * 283 + 59) % 991) / 991 * H;
      const r = 8 + (i % 5) * 7;
      ctx.globalAlpha = 0.1 + (i % 3) * 0.03;
      ctx.fillStyle = i % 3 ? '#9db877' : '#2e5133';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, i, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i++) {
      const x = ((i * 229 + 71) % 983) / 983 * W;
      const y = ((i * 311 + 17) % 971) / 971 * H;
      ctx.strokeStyle = 'rgba(35,66,38,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 4, y - 4); ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = ((i * 419 + 53) % 977) / 977 * W;
      const y = ((i * 503 + 89) % 967) / 967 * H;
      const c = i % 3 === 0 ? '#f2d98b' : i % 3 === 1 ? '#efe4c8' : '#c68fae';
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = c; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(x + Math.cos(k * 2.1) * 3, y + Math.sin(k * 2.1) * 3, 1.5, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 7; i++) {
      const x = ((i * 631 + 121) % 953) / 953 * W;
      const y = 100 + ((i * 431 + 43) % 887) / 887 * (H - 230);
      const r = 10 + (i % 3) * 5;
      ctx.fillStyle = '#4a6b40';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6f8d58'; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.28, r * 0.62, r * 0.44, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPath(v, sc = 1) {
    const p = v.p;
    const gx = v.gate.x, gy = v.gate.y + 28;
    const endX = W * 0.56, endY = H + 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(57,67,40,.25)';
    ctx.lineWidth = Math.min(100, W * 0.23) * sc;
    ctx.beginPath(); ctx.moveTo(gx + 4, gy + 8); ctx.quadraticCurveTo(W * 0.42, (gy + endY) * 0.55, endX + 4, endY); ctx.stroke();
    ctx.strokeStyle = '#b7a171';
    ctx.lineWidth = Math.min(92, W * 0.21) * sc;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(W * 0.43, (gy + endY) * 0.55, endX, endY); ctx.stroke();
    ctx.strokeStyle = '#c9b584';
    ctx.lineWidth = Math.min(76, W * 0.17) * sc;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(W * 0.43, (gy + endY) * 0.55, endX, endY); ctx.stroke();
    for (let i = 0; i < 34; i++) {
      const f = i / 34;
      const x = (1 - f) * (1 - f) * gx + 2 * (1 - f) * f * (W * 0.43) + f * f * endX;
      const y = (1 - f) * (1 - f) * gy + 2 * (1 - f) * f * ((gy + endY) * 0.55) + f * f * endY;
      const ox = Math.sin(i * 2.4) * 42 * sc * (1 - f * 0.3);
      ctx.fillStyle = i % 2 ? '#ad9668' : '#d8c796';
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.ellipse(x + ox, y, (2.5 + (i % 3)) * sc, 1.6 * sc, i, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTree(x, y, s, charges, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(30,48,30,.26)';
    ctx.beginPath(); ctx.ellipse(4, 26, 34, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3826';
    ctx.beginPath(); ctx.moveTo(-8, 22); ctx.quadraticCurveTo(-4, 2, -11, -6); ctx.lineTo(-2, -8); ctx.quadraticCurveTo(5, 0, 5, 22); ctx.fill();
    ctx.fillStyle = '#6f5136'; ctx.fillRect(-1, 4, 6, 19);
    const blobs = [[0, -15, 25, '#2f5638'], [-16, -5, 17, '#3f6b43'], [16, -5, 18, '#386340'], [-4, -26, 16, '#477249'], [4, 2, 20, '#518052']];
    if (charges <= 0) { blobs.forEach(b => b[3] = b[3].replace(/3[0-9a-f]{5}|4[0-9a-f]{5}|5[0-9a-f]{5}/g, '#4f6a4d')); }
    blobs.forEach(([a, b, r, c]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill();
    });
    [[-8, -22, 10], [8, -12, 8], [-17, -5, 7]].forEach(([a, b, r]) => {
      ctx.fillStyle = charges > 0 ? '#84a263' : '#6e8566'; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (charges > 0) {
      const pulse = 0.6 + Math.sin(t * 3 + x) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(13, -20, 3.6, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(13, -20, 12 + pulse * 4, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawCabin(ax, ay, w, s = 1) {
    ctx.save(); ctx.translate(ax, ay); ctx.scale(s, s); let cx = 0, cy = 0;
    const hw = w / 2;
    ctx.fillStyle = 'rgba(30,48,30,.28)';
    ctx.beginPath(); ctx.ellipse(cx + 4, cy + 38, hw + 12, 15, 0, 0, 7); ctx.fill();
    // shadowed log walls
    rounded(cx - hw, cy - 18, w, 54, 4, '#6b4c36', '#3d3025', 2);
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(45,31,22,.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - hw + 3, cy - 11 + i * 11); ctx.lineTo(cx + hw - 3, cy - 11 + i * 11); ctx.stroke();
    }
    ctx.fillStyle = '#8a5d3b';
    ctx.beginPath(); ctx.moveTo(cx - hw - 13, cy - 16); ctx.lineTo(cx - hw + 8, cy - 56); ctx.lineTo(cx + hw - 4, cy - 56); ctx.lineTo(cx + hw + 13, cy - 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a06f45';
    ctx.beginPath(); ctx.moveTo(cx - hw + 8, cy - 56); ctx.lineTo(cx + hw - 4, cy - 56); ctx.lineTo(cx + hw - 12, cy - 43); ctx.lineTo(cx - hw + 2, cy - 43); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5e412a'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const f = i / 6;
      ctx.beginPath(); ctx.moveTo(cx - hw + 8 + f * (w - 12), cy - 56); ctx.lineTo(cx - hw + 2 + f * (w - 14), cy - 42); ctx.stroke();
    }
    // door
    rounded(cx - 14, cy + 4, 28, 32, 3, '#3d2c21', '#8b6745', 1);
    ctx.fillStyle = '#c19658'; ctx.beginPath(); ctx.arc(cx + 8, cy + 20, 2, 0, 7); ctx.fill();
    // window
    rounded(cx + hw - 34, cy - 8, 20, 17, 2, '#e4b968', '#4c3727', 2);
    ctx.strokeStyle = 'rgba(80,54,30,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + hw - 24, cy - 8); ctx.lineTo(cx + hw - 24, cy + 9); ctx.moveTo(cx + hw - 34, cy + 0); ctx.lineTo(cx + hw - 14, cy + 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,120,.16)';
    ctx.beginPath(); ctx.arc(cx + hw - 24, cy, 23, 0, 7); ctx.fill();
    // chimney
    ctx.fillStyle = '#67584a'; ctx.fillRect(cx + hw - 25, cy - 74, 13, 24);
    ctx.fillStyle = '#4d4035'; ctx.fillRect(cx + hw - 27, cy - 77, 17, 5);
    // smoke
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(225,231,215,.15)';
      ctx.beginPath(); ctx.arc(cx + hw - 18 + Math.sin(state.time * 0.7 + i) * 7, cy - 84 - i * 13, 5 + i * 3, 0, 7); ctx.fill();
    }
    // sign
    rounded(cx - hw + 16, cy + 14, 27, 14, 2, '#7d5b3b', '#c49a60');
    text('INN', cx - hw + 29.5, cy + 21, 7, '#f0dcab', 'center', 700);
    // fence
    [cx - hw - 26].forEach((fx) => {
      ctx.fillStyle = '#7b5c3d';
      for (let i = 0; i < 3; i++) ctx.fillRect(fx + i * 17, cy + 8, 4, 27);
      ctx.fillRect(fx - 2, cy + 13, 46, 3);
      ctx.fillRect(fx - 2, cy + 25, 46, 3);
    });
    ctx.restore();
  }

  function drawCamp(v, t, s = 1) {
    ctx.save(); ctx.translate(v.camp.x, v.camp.y); ctx.scale(s, s); let x = 0, y = 0;
    // clearing
    ctx.fillStyle = 'rgba(122,98,62,.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 16, 70, 38, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8c7147'; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(x, y + 14, 56, 28, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // tents
    tent(x - 45, y - 3, 1.04);
    tent(x + 46, y + 3, 0.9);
    // logs
    [[-21, 22, 0.3], [22, 24, -0.25]].forEach(([dx, dy, rot]) => {
      ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(rot);
      rounded(-15, -5, 30, 10, 5, '#6d4d31'); rounded(-15, -5, 30, 4, 3, '#8b6642');
      ctx.restore();
    });
    // fire
    const flick = 1 + Math.sin(t * 9) * 0.09 + Math.sin(t * 14) * 0.05;
    const glow = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 58);
    glow.addColorStop(0, 'rgba(255,196,100,.38)'); glow.addColorStop(1, 'rgba(255,196,100,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y + 4, 58, 0, 7); ctx.fill();
    ctx.fillStyle = '#4f4032';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 17, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ef7c3b';
    ctx.beginPath(); ctx.moveTo(x, y - 21 * flick); ctx.quadraticCurveTo(x + 14, y - 3, x, y + 5); ctx.quadraticCurveTo(x - 14, y - 3, x, y - 21 * flick); ctx.fill();
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath(); ctx.moveTo(x, y - 12 * flick); ctx.quadraticCurveTo(x + 8, y - 1, x, y + 4); ctx.quadraticCurveTo(x - 8, y - 1, x, y - 12 * flick); ctx.fill();
    ctx.fillStyle = 'rgba(255,244,195,.8)';
    ctx.beginPath(); ctx.ellipse(x, y, 3, 5, 0, 0, 7); ctx.fill();
    // found people sit by the fire
    state.people.forEach((p, i) => {
      person(x - 32 + i * 32, y + 26 + (i % 2) * 6, 'villager', ['#a18c73', '#7f9879', '#9b786e'][i % 3], 0.9, false);
    });
    ctx.restore();
    // speech bubble in screen space so it stays legible on small screens
    const cx = v.camp.x, by = v.camp.y - 50 * s, bubbleW = 138;
    rounded(cx - bubbleW / 2, by - 11, bubbleW, 22, 8, '#1b2c22e8', '#e2c48270');
    ctx.fillStyle = '#1b2c22e8';
    ctx.beginPath(); ctx.moveTo(cx - 5, by + 11); ctx.lineTo(cx + 5, by + 11); ctx.lineTo(cx, by + 17); ctx.fill();
    text(state.people.length < 3 ? 'TAP · TRAVELERS' : 'YOUR GUILD', cx, by, 8, '#f0d99c', 'center', 700);
  }

  function tent(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(30,48,30,.28)';
    ctx.beginPath(); ctx.ellipse(0, 14, 29, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6844';
    ctx.beginPath(); ctx.moveTo(-27, 11); ctx.lineTo(-12, -20); ctx.lineTo(16, -20); ctx.lineTo(29, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a98054';
    ctx.beginPath(); ctx.moveTo(-27, 11); ctx.lineTo(-12, -20); ctx.lineTo(-6, -20); ctx.lineTo(-15, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4e3826';
    ctx.beginPath(); ctx.moveTo(-8, 11); ctx.lineTo(-3, -16); ctx.lineTo(10, -16); ctx.lineTo(14, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d6b984'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(16, -20); ctx.stroke();
    ctx.strokeStyle = 'rgba(219,191,138,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-27, 11); ctx.lineTo(-12, -20); ctx.moveTo(29, 11); ctx.lineTo(16, -20); ctx.stroke();
    ctx.fillStyle = '#6f5136'; ctx.fillRect(-2, -22, 4, 4);
    ctx.restore();
  }

  function drawGate(v, s = 1) {
    ctx.save(); ctx.translate(v.gate.x, v.gate.y); ctx.scale(s, s); let x = 0, y = 0;
    const open = state.coins >= 6;
    ctx.fillStyle = 'rgba(30,48,30,.32)';
    ctx.beginPath(); ctx.ellipse(x, y + 38, 58, 14, 0, 0, 7); ctx.fill();
    // outer stone arch
    ctx.fillStyle = '#736c5d';
    ctx.beginPath();
    ctx.moveTo(x - 54, y + 37); ctx.lineTo(x - 54, y - 17);
    ctx.quadraticCurveTo(x - 54, y - 49, x - 27, y - 49);
    ctx.lineTo(x + 27, y - 49);
    ctx.quadraticCurveTo(x + 54, y - 49, x + 54, y - 17);
    ctx.lineTo(x + 54, y + 37); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#928874'; ctx.lineWidth = 2; ctx.stroke();
    // stone blocks
    ctx.strokeStyle = 'rgba(57,52,43,.42)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const by = y + 30 - i * 13;
      ctx.beginPath(); ctx.moveTo(x - 54, by); ctx.lineTo(x - 31, by); ctx.moveTo(x + 31, by); ctx.lineTo(x + 54, by); ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 54, y - 17 + Math.sin(a) * 32); ctx.lineTo(x + Math.cos(a) * 31, y - 17 + Math.sin(a) * 32); ctx.stroke();
    }
    // opening
    ctx.fillStyle = '#1c221c';
    ctx.beginPath();
    ctx.moveTo(x - 31, y + 37); ctx.lineTo(x - 31, y - 12);
    ctx.quadraticCurveTo(x - 31, y - 36, x, y - 36);
    ctx.quadraticCurveTo(x + 31, y - 36, x + 31, y - 12);
    ctx.lineTo(x + 31, y + 37); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(172,152,108,.35)'; ctx.lineWidth = 2; ctx.stroke();
    if (open) {
      const gl = ctx.createLinearGradient(x, y - 20, x, y + 37);
      gl.addColorStop(0, 'rgba(255,196,100,.28)'); gl.addColorStop(1, 'rgba(255,196,100,0)');
      ctx.fillStyle = gl; ctx.fillRect(x - 30, y - 30, 60, 67);
      // receding steps
      ctx.fillStyle = '#3a3a31';
      for (let i = 0; i < 4; i++) {
        const w = 24 - i * 4;
        ctx.beginPath(); ctx.ellipse(x, y + 6 + i * 7, w, 3.2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = i % 2 ? '#46463b' : '#3f3f35';
      }
      ctx.fillStyle = 'rgba(245,197,104,.4)';
      ctx.beginPath(); ctx.arc(x, y + 4, 3.4, 0, 7); ctx.fill();
      // raised portcullis
      ctx.strokeStyle = '#877a60'; ctx.lineWidth = 2.4;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 12, y - 34); ctx.lineTo(x + i * 12, y - 22); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x - 28, y - 24); ctx.lineTo(x + 28, y - 24); ctx.stroke();
      // little threshold
      ctx.fillStyle = 'rgba(226,191,126,.5)';
      ctx.fillRect(x - 33, y + 36, 66, 3);
    } else {
      // chains
      ctx.strokeStyle = '#b2915c'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(x - 31, y - 8); ctx.lineTo(x + 31, y + 12); ctx.moveTo(x - 31, y + 12); ctx.lineTo(x + 31, y - 8); ctx.stroke();
      ctx.fillStyle = '#c9a45e';
      ctx.beginPath(); ctx.roundRect(x - 9, y - 3, 18, 15, 3); ctx.fill();
      ctx.strokeStyle = '#6b512f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 4, 6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#40341f'; ctx.beginPath(); ctx.arc(x, y + 4, 2, 0, 7); ctx.fill();
      // steps in front
      ctx.fillStyle = '#5b5a4b';
      ctx.beginPath(); ctx.ellipse(x, y + 39, 40, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6c6a58';
      ctx.beginPath(); ctx.ellipse(x, y + 37, 35, 4.5, 0, 0, 7); ctx.fill();
    }
    // banners
    [-1, 1].forEach((dir) => {
      const bx = x + dir * 48;
      ctx.fillStyle = dir < 0 ? '#7d3a32' : '#8a4036';
      ctx.fillRect(bx - 5, y - 40, 10, 27);
      ctx.fillStyle = '#a85545';
      ctx.beginPath(); ctx.moveTo(bx - 5, y - 13); ctx.lineTo(bx, y - 6); ctx.lineTo(bx + 5, y - 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7b878'; ctx.beginPath(); ctx.arc(bx, y - 28, 2.2, 0, 7); ctx.fill();
    });
    // vines
    ctx.strokeStyle = 'rgba(89,119,66,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 50, y - 36); ctx.quadraticCurveTo(x - 40, y - 22, x - 51, y - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 49, y - 30); ctx.quadraticCurveTo(x + 40, y - 16, x + 49, y + 4); ctx.stroke();
    ctx.fillStyle = 'rgba(117,148,85,.7)';
    [[-45, -25], [-48, -13], [44, -20], [46, -6]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.ellipse(x + a, y + b, 4, 2.2, 0.6, 0, 7); ctx.fill();
    });
    // plaque set into the keystone
    rounded(x - 26, y - 48, 52, 12, 3, '#4a4438', '#a99a7e');
    text('THE RUIN', x, y - 42, 7, open ? '#ffe19a' : '#ded2ae', 'center', 700);
    ctx.restore();
  }

  function drawGarden(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); x = 0; y = 0;
    ctx.fillStyle = 'rgba(49,66,40,.35)';
    rounded(x - 36, y - 23, 72, 46, 6, '#6b563a');
    rounded(x - 32, y - 19, 64, 38, 4, '#7d6341');
    for (let r = 0; r < 3; r++) {
      ctx.fillStyle = 'rgba(58,44,29,.45)';
      ctx.beginPath(); ctx.ellipse(x, y - 11 + r * 11, 26, 4, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const sx = x - 20 + k * 10 + (r % 2) * 3;
        const sy = y - 11 + r * 11;
        ctx.strokeStyle = '#6f9450'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 2, sy - 5); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 3, sy - 4); ctx.stroke();
        ctx.fillStyle = '#88a95e'; ctx.beginPath(); ctx.arc(sx + 1, sy - 5, 1.4, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(x - 38, y - 26, 76, 3);
    ctx.fillStyle = '#5f4630';
    ctx.fillRect(x - 38, y + 20, 6, 8); ctx.fillRect(x + 32, y + 20, 6, 8);
    ctx.restore();
  }

  function drawWell(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); x = 0; y = 0;
    ctx.fillStyle = 'rgba(30,48,30,.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 18, 31, 11, 0, 0, 7); ctx.fill();
    // posts and roof
    ctx.fillStyle = '#6b4d33';
    ctx.fillRect(x - 24, y - 40, 4, 42); ctx.fillRect(x + 20, y - 40, 4, 42);
    ctx.fillStyle = '#8a5c3b';
    ctx.beginPath(); ctx.moveTo(x - 33, y - 34); ctx.lineTo(x, y - 55); ctx.lineTo(x + 33, y - 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a4734a';
    ctx.beginPath(); ctx.moveTo(x - 29, y - 35); ctx.lineTo(x, y - 51); ctx.lineTo(x, y - 44); ctx.lineTo(x - 22, y - 32); ctx.fill();
    // stone rim
    ctx.fillStyle = '#8b8573';
    ctx.beginPath(); ctx.ellipse(x, y, 27, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b5b50';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 20, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e4b4a';
    ctx.beginPath(); ctx.ellipse(x, y, 17, 5.5, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(215,208,180,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 27, Math.PI + i * 0.55, Math.PI + i * 0.55 + 0.3); ctx.stroke();
    }
    // bucket
    ctx.strokeStyle = '#b8a173'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x, y - 16); ctx.stroke();
    rounded(x - 6, y - 16, 12, 10, 2, '#7d5a38', '#c9a86d');
    ctx.restore();
  }

  function drawLeaves(t) {
    for (let i = 0; i < 8; i++) {
      const x = (W + 120) * (((i * 0.173 + t * 0.008) % 1)) - 30;
      const y = (H - 80) * ((i * 0.291 + Math.sin(t * 0.4 + i) * 0.04) % 1) + 50;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.7 + i);
      ctx.fillStyle = i % 2 ? 'rgba(214,190,110,.26)' : 'rgba(150,180,110,.24)';
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.4, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawBoard(x, y) {
    ctx.fillStyle = '#5c432e'; ctx.fillRect(x - 2, y + 30, 4, 22);
    ctx.fillStyle = '#5c432e'; ctx.fillRect(x - 22, y + 40, 44, 11);
    rounded(x - 27, y, 54, 34, 3, '#7a5838', '#c49a60', 2);
    ctx.fillStyle = '#e6cd92'; ctx.fillRect(x - 20, y + 7, 30, 2); ctx.fillRect(x - 20, y + 14, 23, 2); ctx.fillRect(x - 20, y + 21, 27, 2);
    ctx.fillStyle = '#b4382f'; ctx.beginPath(); ctx.arc(x + 17, y + 9, 3, 0, 7); ctx.fill();
  }

  function person(x, y, type, col, scale = 1, hero = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * (hero ? state.hero.dir : 1), scale);
    const bob = hero ? Math.sin(state.hero.step * 9) * 1.2 : Math.sin(state.time * 1.5 + x) * 0.5;
    ctx.fillStyle = 'rgba(20,30,20,.28)';
    ctx.beginPath(); ctx.ellipse(0, 14, 12, 4, 0, 0, 7); ctx.fill();
    // legs
    ctx.fillStyle = '#3a3a30';
    ctx.fillRect(-6, 7, 5, 7); ctx.fillRect(2, 7, 5, 7);
    // cloak
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-11, -3 + bob); ctx.quadraticCurveTo(-13, 9, -9, 10); ctx.lineTo(9, 10); ctx.quadraticCurveTo(13, 9, 11, -3 + bob); ctx.quadraticCurveTo(0, -8 + bob, -11, -3 + bob); ctx.fill();
    // belt
    ctx.fillStyle = '#cfae70'; ctx.fillRect(-9, 4 + bob, 18, 2);
    // head
    ctx.fillStyle = '#dfb887';
    ctx.beginPath(); ctx.arc(0, -10 + bob, 7, 0, 7); ctx.fill();
    if (hero) {
      // steel cap with a plume
      ctx.fillStyle = '#8495ab';
      ctx.beginPath(); ctx.arc(0, -11 + bob, 7.4, Math.PI, 0); ctx.lineTo(7.4, -8 + bob); ctx.lineTo(-7.4, -8 + bob); ctx.fill();
      ctx.fillStyle = '#cfb06f'; ctx.fillRect(-7, -9.4 + bob, 14, 1.8);
      ctx.fillStyle = '#a23f34';
      ctx.beginPath(); ctx.moveTo(0, -17 + bob); ctx.quadraticCurveTo(7, -22 + bob, 5, -25 + bob); ctx.quadraticCurveTo(3, -21 + bob, -1, -18 + bob); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#5b4938';
      ctx.beginPath(); ctx.arc(0, -12 + bob, 7.2, Math.PI, 0); ctx.lineTo(7, -8 + bob); ctx.lineTo(-7, -8 + bob); ctx.fill();
    }
    // eyes
    ctx.fillStyle = '#2d2922';
    ctx.fillRect(1.5, -10 + bob, 1.6, 1.6); ctx.fillRect(-3.2, -10 + bob, 1.6, 1.6);
    if (hero) {
      // little sword
      ctx.save(); ctx.translate(11, -1 + bob); ctx.rotate(-0.18);
      ctx.fillStyle = '#e4d3a5'; ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.lineTo(1, 17); ctx.lineTo(-1, 17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#cfae70'; ctx.fillRect(-4.5, 0, 9, 2.4);
      ctx.fillStyle = '#7f5a34'; ctx.fillRect(-1, -5, 2, 6);
      ctx.fillStyle = '#d6b878'; ctx.beginPath(); ctx.arc(0, -5.5, 1.6, 0, 7); ctx.fill();
      ctx.restore();
      // shield
      ctx.fillStyle = '#4a6d7d'; ctx.beginPath(); ctx.ellipse(-10, 2 + bob, 4, 6, 0.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9b371'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }

  function drawVillage(t) {
    drawGrass(t);
    const v = village(), vs = viewScale();
    drawPath(v, vs);
    if (W > H) {
      ctx.strokeStyle = '#c9b584'; ctx.lineWidth = 24 * vs; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(v.cabin.x + 18 * vs, v.cabin.y + 28 * vs);
      ctx.quadraticCurveTo(v.cabin.x + 70 * vs, v.cabin.y + 30 * vs, W * 0.455, v.cabin.y + 42 * vs);
      ctx.stroke();
    }
    if (W <= H) {
      const pv = v.cabin, cy = pv.y + 30 * vs;
      ctx.fillStyle = '#a9946c';
      ctx.beginPath(); ctx.ellipse(pv.x, cy, 84 * vs, 60 * vs, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9b584';
      ctx.beginPath(); ctx.ellipse(pv.x, cy - 2 * vs, 77 * vs, 53 * vs, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(122,98,62,.22)';
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(pv.x + Math.cos(a) * (64 + (i % 3) * 5) * vs, cy + Math.sin(a) * (42 + (i % 2) * 6) * vs, 2.6 * vs, 1.4 * vs, a, 0, 7); ctx.fill();
      }
    }
    drawGate(v, vs);
    drawCabin(v.cabin.x, v.cabin.y, 118, vs);
    drawGarden(W * 0.19, v.p.top + (v.p.bottom - v.p.top) * 0.42, vs);
    drawWell(W * 0.84, v.p.top + (v.p.bottom - v.p.top) * 0.48, vs);
    trees.forEach((tr, i) => {
      const x = W * tr.x, y = v.p.top + (v.p.bottom - v.p.top) * tr.y;
      drawTree(x, y, tr.big * vs, state.treeCharges[i], t);
    });
    drawCamp(v, t, vs);
    person(state.hero.x, state.hero.y, 'hero', '#536d8c', 1.28 * vs, true);
    if (state.people.length >= 3) {
      rounded(v.camp.x - 34, v.camp.y + 46, 68, 13, 5, '#1b2c22cc', '#e2c48250');
      text('GUILD READY', v.camp.x, v.camp.y + 52.5, 7, '#e9d59c', 'center', 700);
    }
    drawLeaves(t);
    drawFloaters();
  }

  /* ---------------- dungeon ---------------- */

  function drawDungeon(t) {
    const p = playfield();
    const top = p.top + 4, bot = p.bottom, left = 6, right = W - 6;
    ctx.fillStyle = '#26231f'; ctx.fillRect(0, 0, W, H);
    // room shell
    rounded(left, top, right - left, bot - top, 9, '#5e5341');
    rounded(left + 8, top + 8, right - left - 16, bot - top - 16, 5, '#3d372e');
    // stone flagstones
    ctx.fillStyle = '#3b362c';
    ctx.fillRect(left + 8, top + 30, right - left - 16, bot - top - 46);
    const tw = Math.max(62, Math.min(104, (right - left) / 4.6)), th = 54;
    for (let y = top + 32, row = 0; y < bot - 20; y += th, row++) {
      for (let x = left + 10 + (row % 2) * tw / 2; x < right - 12; x += tw) {
        const w = Math.min(tw - 4, right - 10 - x);
        if (w < 10) continue;
        const tone = row % 2 ? '#575145' : '#524c40';
        ctx.fillStyle = tone;
        ctx.fillRect(x, y, w, th - 4);
        // broad weathered patches instead of brick-like bevels
        ctx.fillStyle = 'rgba(210,190,150,.05)';
        ctx.fillRect(x + 3, y + 2, w - 6, 7);
        ctx.fillStyle = row % 2 ? 'rgba(72,86,58,.07)' : 'rgba(176,158,116,.05)';
        ctx.beginPath();
        ctx.ellipse(x + w * (0.3 + (row % 3) * 0.2), y + th * 0.6, w * 0.22, 7, 0.2, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(28,25,19,.24)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, th - 5);
        // hairline cracks on some slabs
        if ((row * 5 + Math.round(x / tw)) % 4 === 1) {
          ctx.strokeStyle = 'rgba(30,27,20,.28)'; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.55, y + 8);
          ctx.lineTo(x + w * 0.62, y + 17);
          ctx.lineTo(x + w * 0.58, y + 26);
          ctx.stroke();
        }
      }
    }
    // rubble along the lower corners
    [[left + 26, bot - 34], [right - 30, bot - 40], [left + 44, bot - 50]].forEach(([rx, ry], i) => {
      for (let k = 0; k < 4; k++) {
        const a = rx + Math.cos(k * 1.9 + i) * (7 + k * 3);
        const bb = ry + Math.sin(k * 2.3 + i) * (3 + k * 2);
        ctx.fillStyle = k % 2 ? '#5b5546' : '#494435';
        ctx.beginPath(); ctx.ellipse(a, bb, 4 + (k % 2) * 2, 2.6, k, 0, 7); ctx.fill();
      }
    });
    // moss / cracks
    for (let i = 0; i < 9; i++) {
      const x = left + 30 + ((i * 271 + 41) % 811) / 811 * (right - left - 60);
      const y = top + 50 + ((i * 193 + 17) % 601) / 601 * (bot - top - 100);
      ctx.strokeStyle = 'rgba(24,28,22,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x + 4, y + 12); ctx.stroke();
      ctx.fillStyle = 'rgba(69,94,55,.28)';
      ctx.beginPath(); ctx.ellipse(x + 15, y + 16, 9, 4, 0.3, 0, 7); ctx.fill();
    }
    // wall band
    ctx.fillStyle = '#6d604a'; ctx.fillRect(left + 8, top + 8, right - left - 16, 24);
    ctx.fillStyle = '#8d7c5c'; ctx.fillRect(left + 8, top + 29, right - left - 16, 3);
    // pillars
    [W * 0.16, W * 0.84].forEach((x) => {
      rounded(x - 13, top + 30, 26, bot - top - 55, 4, '#5a5142', '#847455', 1.5);
      rounded(x - 17, top + 26, 34, 10, 3, '#807155');
      rounded(x - 17, bot - 28, 34, 10, 3, '#4b4338');
      ctx.fillStyle = 'rgba(30,30,24,.25)'; ctx.fillRect(x + 6, top + 36, 5, bot - top - 66);
    });
    // torches
    [W * 0.3, W * 0.7].forEach((x) => {
      const f = 1 + Math.sin(t * 11 + x) * 0.16;
      const gl = ctx.createRadialGradient(x, top + 22, 2, x, top + 22, 46);
      gl.addColorStop(0, 'rgba(255,186,92,.3)'); gl.addColorStop(1, 'rgba(255,186,92,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, top + 22, 46, 0, 7); ctx.fill();
      ctx.fillStyle = '#4b3a2b'; ctx.fillRect(x - 3, top + 16, 6, 12);
      ctx.fillStyle = '#f08e46'; ctx.beginPath(); ctx.ellipse(x, top + 15, 4.5, 7 * f, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd87a'; ctx.beginPath(); ctx.ellipse(x, top + 16, 2, 4 * f, 0, 0, 7); ctx.fill();
    });
    // sealed door
    rounded(W * 0.5 - 35, top + 0, 70, 42, 4, '#463c2c', '#b18e57', 1.5);
    ctx.fillStyle = '#2b241d'; ctx.fillRect(W * 0.5 - 27, top + 6, 54, 32);
    for (let i = -1; i <= 1; i++) ctx.fillRect(W * 0.5 + i * 15 - 2, top + 5, 4, 34);
    text(state.key ? 'OPEN' : 'SEALED', W * 0.5, top + 21, 7, state.key ? '#f6d681' : '#b9a985', 'center', 700);

    // key pedestal
    if (!state.key) {
      const kp = keyPos(), kx = kp.x, ky = kp.y;
      ctx.fillStyle = 'rgba(255,214,118,.09)';
      ctx.beginPath(); ctx.arc(kx, ky, 42 + Math.sin(t * 2.5) * 5, 0, 7); ctx.fill();
      rounded(kx - 20, ky + 16, 40, 12, 3, '#6a5a41', '#8e7a56');
      rounded(kx - 13, ky + 7, 26, 12, 2, '#8a7550');
      drawKey(kx, ky - 4, t);
      text('THE OLD KEY', kx, ky - 38, 8, '#f2d795', 'center', 700);
    }
    // slimes
    state.slimes.forEach((e) => { if (e.hp > 0) drawSlime(e.x, e.y, e.hit > 0); });
    // boss
    drawBoss(state.boss, t);
    // boss rune circle
    const bx = state.boss.x, by = state.boss.y;
    ctx.strokeStyle = 'rgba(219,177,99,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by + 4, 86, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(219,177,99,.09)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by + 4, 74, 0, 7); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(219,177,99,.18)';
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 77, by + 4 + Math.sin(a) * 77); ctx.lineTo(bx + Math.cos(a) * 84, by + 4 + Math.sin(a) * 84); ctx.stroke();
    }
    // fireballs
    state.shots.forEach((s) => {
      ctx.fillStyle = 'rgba(255,138,60,.16)'; ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#f18842'; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffda82'; ctx.beginPath(); ctx.arc(s.x - 1, s.y - 1, 3.4, 0, 7); ctx.fill();
    });
    // hero
    if (state.hero.invuln > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
    person(state.hero.x, state.hero.y, 'hero', '#536d8c', 1.28 * viewScale(), true);
    ctx.globalAlpha = 1;
    if (state.hero.attack > 0) {
      const a = state.hero.attack / 0.42;
      ctx.strokeStyle = `rgba(255,240,190,${0.65 * a})`;
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(state.hero.x, state.hero.y - 2, 30, -1.2 + a * 1.4, 0.5 + a * 1.4); ctx.stroke();
    }
    // vignette
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.48, Math.min(W, H) * 0.24, W * 0.5, H * 0.48, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(8,10,7,0)'); vg.addColorStop(1, 'rgba(8,10,7,.3)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawFloaters();
  }

  function drawKey(x, y, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.8) * 0.09 - 0.3);
    ctx.strokeStyle = '#f5cd6a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, -8, 9, 0, 7); ctx.stroke();
    ctx.fillStyle = '#f5cd6a'; ctx.fillRect(-2.5, 0, 5, 23);
    ctx.fillRect(1, 14, 10, 4); ctx.fillRect(1, 21, 8, 4);
    ctx.fillStyle = 'rgba(255,235,160,.5)'; ctx.fillRect(-1, -7, 2, 8);
    ctx.restore();
  }

  function drawSlime(x, y, hit) {
    ctx.fillStyle = 'rgba(20,26,20,.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 11, 18, 6, 0, 0, 7); ctx.fill();
    const squash = 1 + Math.sin(state.time * 5 + x) * 0.05;
    ctx.fillStyle = hit ? '#d8e2b0' : '#6f9953';
    ctx.beginPath(); ctx.moveTo(x - 16, y + 7); ctx.quadraticCurveTo(x - 18, y - 14 * squash, x, y - 17 * squash); ctx.quadraticCurveTo(x + 18, y - 14 * squash, x + 16, y + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(205,228,160,.35)';
    ctx.beginPath(); ctx.ellipse(x - 6, y - 9, 6, 4, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#273026'; ctx.fillRect(x - 6, y - 5, 3, 4); ctx.fillRect(x + 5, y - 5, 3, 4);
    ctx.strokeStyle = '#273026'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y + 2, 3, 0.2, 2.6); ctx.stroke();
  }

  function drawBoss(b, t) {
    if (b.hp <= 0) return;
    const keyed = state.key;
    const x = b.x, y = b.y;
    const breathe = 1 + Math.sin(t * 2) * 0.022;
    const flap = keyed ? 1 + Math.sin(t * 3.2) * 0.035 : 1;
    const hide = keyed ? '#b44a36' : '#5d6a51';
    const deep = keyed ? '#7f2d24' : '#414d3c';
    const wing = keyed ? '#8d332a' : '#46523f';
    const wingIn = keyed ? '#a84a38' : '#55644a';
    ctx.save(); ctx.translate(x, y); ctx.scale(1.1, 1.1);
    // shadow
    ctx.fillStyle = 'rgba(9,10,8,.42)';
    ctx.beginPath(); ctx.ellipse(0, 21, 60, 20, 0, 0, 7); ctx.fill();
    // hoard
    if (!keyed) {
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = i % 2 ? '#c99a43' : '#e7c46d';
        ctx.beginPath(); ctx.ellipse(-48 + (i * 23) % 96, 21 + (i % 3) * 4, 5.5, 2.4, 0.25, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#f1d683';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-36 + i * 24, 18, 2, 0, 7); ctx.fill(); }
    }
    // tail
    ctx.strokeStyle = deep; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(20, 7); ctx.quadraticCurveTo(53, 13, 62, -4); ctx.quadraticCurveTo(67, -19, 52, -23); ctx.stroke();
    ctx.fillStyle = hide;
    const tw = keyed ? 1 : 0.86;
    ctx.beginPath();
    ctx.moveTo(52, -23); ctx.lineTo(66 * tw, -37); ctx.lineTo(58, -18); ctx.closePath(); ctx.fill();
    // wings
    ctx.save(); ctx.scale(flap, 1);
    [-1, 1].forEach((dir) => {
      ctx.save(); ctx.scale(dir, 1);
      ctx.fillStyle = wing;
      ctx.beginPath();
      ctx.moveTo(16, -12);
      ctx.quadraticCurveTo(40, -34, 64, -44);
      ctx.lineTo(60, -22);
      ctx.lineTo(70, -10);
      ctx.lineTo(48, -2);
      ctx.lineTo(38, 10);
      ctx.quadraticCurveTo(26, 2, 16, -12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = wingIn;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(18, -12); ctx.quadraticCurveTo(42, -27, 60, -36);
      ctx.lineTo(56, -21); ctx.lineTo(64, -12); ctx.lineTo(46, -4); ctx.lineTo(38, 5);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = deep; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(18, -12); ctx.lineTo(48, -27); ctx.moveTo(20, -6); ctx.lineTo(51, -14); ctx.moveTo(23, 1); ctx.lineTo(44, -3); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    // body
    const body = ctx.createLinearGradient(0, -28, 0, 24);
    body.addColorStop(0, hide); body.addColorStop(1, deep);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, 37, 25, 0, 0, 7); ctx.fill();
    // scales
    ctx.fillStyle = keyed ? 'rgba(240,160,120,.22)' : 'rgba(170,190,150,.18)';
    [[-22, -6, 8, 4], [-10, -13, 9, 4.5], [4, -14, 9, 4.5], [18, -8, 8, 4], [-2, -3, 7, 3.5]].forEach(([a, bb, r1, r2]) => {
      ctx.beginPath(); ctx.ellipse(a, bb, r1, r2, 0.3, 0, 7); ctx.fill();
    });
    // belly plates
    ctx.fillStyle = keyed ? '#e3a366' : '#9a9674'; ctx.globalAlpha = 0.75;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(0, 9 + i * 4, 21 - i * 3, 3.2, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // legs & claws
    ctx.fillStyle = deep;
    [[-26, 14], [25, 15], [-16, 19], [16, 20]].forEach(([a, bb], i) => {
      ctx.beginPath(); ctx.ellipse(a, bb, 7, 5, i % 2 ? 0.2 : -0.2, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = '#e3d5b1'; ctx.lineWidth = 1.4;
    [[-31, 18], [-24, 19], [28, 20], [21, 21]].forEach(([a, bb]) => {
      ctx.beginPath(); ctx.moveTo(a, bb); ctx.lineTo(a - 2, bb + 4); ctx.stroke();
    });
    // dorsal spikes
    ctx.fillStyle = keyed ? '#7a2b22' : '#3b4636';
    [[-17, -17, -23, -29, -11, -22], [19, -17, 26, -28, 13, -22]].forEach(([a, bb, c, d, e, f]) => {
      ctx.beginPath(); ctx.moveTo(a, bb); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.closePath(); ctx.fill();
    });
    // head
    ctx.fillStyle = hide;
    ctx.beginPath(); ctx.ellipse(0, -27, 19, 14, 0, 0, 7); ctx.fill();
    // horns swept back
    ctx.fillStyle = '#d8c08c';
    [-1, 1].forEach((dir) => {
      ctx.save(); ctx.scale(dir, 1);
      ctx.beginPath(); ctx.moveTo(13, -31); ctx.quadraticCurveTo(22, -43, 32, -45); ctx.quadraticCurveTo(23, -35, 17, -25); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    // snout
    ctx.fillStyle = hide;
    ctx.beginPath(); ctx.ellipse(0, -39, 11, 8.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3b2a22'; ctx.beginPath(); ctx.arc(-4, -43, 1.5, 0, 7); ctx.arc(4, -43, 1.5, 0, 7); ctx.fill();
    // mouth
    if (keyed) {
      ctx.strokeStyle = '#4a201b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, -34); ctx.quadraticCurveTo(0, -30, 7, -34); ctx.stroke();
      ctx.fillStyle = '#f3e7c7';
      ctx.beginPath(); ctx.moveTo(-6, -35); ctx.lineTo(-3.5, -30); ctx.lineTo(-1.5, -34.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -35); ctx.lineTo(3.5, -30); ctx.lineTo(1.5, -34.5); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = '#394231'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-5, -35); ctx.quadraticCurveTo(0, -33, 5, -35); ctx.stroke();
    }
    // eyes
    if (keyed) {
      ctx.fillStyle = 'rgba(255,206,86,.2)';
      ctx.beginPath(); ctx.arc(-8, -29, 7, 0, 7); ctx.arc(8, -29, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd45f';
      ctx.beginPath(); ctx.ellipse(-8, -29, 3.2, 3.8, 0, 0, 7); ctx.ellipse(8, -29, 3.2, 3.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a2112';
      ctx.beginPath(); ctx.ellipse(-8, -29, 1.1, 3, 0, 0, 7); ctx.ellipse(8, -29, 1.1, 3, 0, 0, 7); ctx.fill();
      // smoke puffs
      for (let i = 0; i < 2; i++) {
        const a = t * 0.9 + i * 2.2;
        ctx.fillStyle = 'rgba(120,125,110,.16)';
        ctx.beginPath(); ctx.arc(13 + Math.sin(a) * 7, -49 - i * 8, 4 + i * 2, 0, 7); ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#8f8567'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-8, -30, 3, 0.2, 2.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(8, -30, 3, 0.2, 2.9); ctx.stroke();
      text('z z', 25, -45, 9, 'rgba(226,212,170,.55)', 'center', 700);
    }
    ctx.restore();
    if (keyed) {
      rounded(x - 52, y - 64, 104, 9, 5, '#322b25', '#aa9160');
      rounded(x - 50, y - 62, 100 * (b.hp / b.max), 5, 3, '#d1543b');
      text('RUIN WARDEN', x, y - 74, 8, '#ead9b4', 'center', 700);
    }
  }

  function drawFloaters() {
    state.floaters.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life * 1.6);
      text(f.s, f.x, f.y - (1.1 - f.life) * 28, 13, f.color, 'center', 700);
      ctx.globalAlpha = 1;
    });
  }

  /* ---------------- HUD & controls ---------------- */

  function coinIcon(cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
    ctx.fillStyle = '#e8c46c'; ctx.fill();
    ctx.strokeStyle = '#8b672f'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, 7);
    ctx.strokeStyle = 'rgba(120,84,32,.55)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,196,.75)';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.22, 0, 7); ctx.fill();
  }
  function personIcon(cx, cy) {
    ctx.fillStyle = '#e7d4a9';
    ctx.beginPath(); ctx.arc(cx, cy - 3.6, 2.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 5, cy + 4.6); ctx.quadraticCurveTo(cx - 4.6, cy - 1.6, cx, cy - 1.6); ctx.quadraticCurveTo(cx + 4.6, cy - 1.6, cx + 5, cy + 4.6); ctx.closePath(); ctx.fill();
  }
  function heartIcon(cx, cy, s, filled) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s / 10, s / 10);
    ctx.beginPath();
    ctx.moveTo(0, 7.2);
    ctx.bezierCurveTo(-1.8, 5.2, -8.6, 0.3, -8.6, -3.6);
    ctx.bezierCurveTo(-8.6, -7.4, -4.6, -8.8, 0, -4.6);
    ctx.bezierCurveTo(4.6, -8.8, 8.6, -7.4, 8.6, -3.6);
    ctx.bezierCurveTo(8.6, 0.3, 1.8, 5.2, 0, 7.2);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#e0705a'; ctx.fill();
      ctx.strokeStyle = '#7e352c'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,224,188,.6)';
      ctx.beginPath(); ctx.ellipse(-4, -3.2, 1.7, 1.1, -0.5, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(72,40,34,.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(233,160,136,.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    const y = 11 + safe.t, lx = 9 + safe.l;
    rounded(lx, y, W - 18 - safe.l - safe.r, 44, 14, 'rgba(20,34,26,.94)', 'rgba(208,170,104,.38)');
    text('✦', lx + 18, y + 22, 18, '#ddb66d', 'center', 600);
    text('HEARTHVALE', lx + 33, y + 15, 9, '#dac28e', 'left', 700);
    text(scene === 'village' ? 'VILLAGE' : 'THE OLD RUIN', lx + 33, y + 30, 8, '#96a68b', 'left', 600);
    if (scene === 'village') {
      const jobsW = 58, peopleW = 40, coinW = 66, gap = 4;
      const startX = W - 9 - safe.r - (jobsW + peopleW + coinW + gap * 2);
      rounded(startX, y + 9, coinW, 26, 8, '#22352a', '#8e805e');
      coinIcon(startX + 14, y + 22, 6);
      text(String(state.coins), startX + 28, y + 22, 12, '#f2dcab', 'left', 700);
      rounded(startX + coinW + gap, y + 9, peopleW, 26, 8, '#22352a', '#8e805e');
      personIcon(startX + coinW + gap + 12, y + 22);
      text(String(state.people.length), startX + coinW + gap + 26, y + 22, 10, '#dcd5bd', 'center', 700);
      const bx = startX + coinW + peopleW + gap * 2;
      rounded(bx, y + 9, jobsW, 26, 8, '#344430', '#b2a46e');
      text('JOBS ↗', bx + jobsW / 2, y + 22, 9, '#f2dfad', 'center', 700);
      // quest strip
      const q = state.coins >= 6 ? 'THE RUIN IS OPEN · TAP THE GATE' : `GATHER OLD COINS · ${Math.min(state.coins, 6)}/6`;
      const qw = Math.min(W - 28 - safe.l - safe.r, 236), qx = (W - qw) / 2, qy = 64 + safe.t;
      rounded(qx, qy, qw, 23, 8, state.coins >= 6 ? 'rgba(68,52,28,.92)' : 'rgba(20,34,26,.82)', state.coins >= 6 ? '#e7c47b' : 'rgba(226,196,130,.3)');
      text(state.coins >= 6 ? '✦ ' : '◉ ', qx + 14, qy + 12, 10, '#e9c574', 'center', 700);
      text(q, qx + 26, qy + 12, 8, state.coins >= 6 ? '#ffe4a2' : '#dfd7b8', 'left', 700);
    } else {
      const maxHearts = state.hero.max;
      const hsp = maxHearts > 6 ? 11 : 14;
      const hs = maxHearts > 6 ? 9.5 : 11;
      const hW = 16 + maxHearts * hsp;
      const hx = W - 9 - safe.r - hW;
      rounded(hx, y + 9, hW, 26, 8, '#3c2925', '#9d5140');
      for (let i = 0; i < maxHearts; i++) {
        heartIcon(hx + 15 + i * hsp, y + 22, hs, i < state.hero.hp);
      }
      const kx = 122 + safe.l;
      rounded(kx, y + 9, 84, 26, 8, '#22352a', state.key ? '#c8a25c' : '#6b6a56');
      text(state.key ? '✦ KEY FOUND' : '✦ FIND KEY', kx + 42, y + 23, 8, state.key ? '#f4cb69' : '#b9b8a2', 'center', 700);
      const q = state.key ? (state.boss.hp > 0 ? 'DEFEAT THE RUIN WARDEN' : 'THE RUIN IS CLEARED') : 'FIND THE OLD KEY IN THE RUIN';
      const qw = Math.min(W - 28 - safe.l - safe.r, 250), qx = (W - qw) / 2, qy = 64 + safe.t;
      rounded(qx, qy, qw, 23, 8, 'rgba(20,30,25,.86)', 'rgba(226,196,130,.3)');
      text(q, qx + qw / 2, qy + 12, 8, '#e7ddbd', 'center', 700);
    }
  }

  function control(x, y, label, action, r, primary) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.fillStyle = pointer?.action === action ? '#bd9757' : 'rgba(20,35,27,.78)';
    ctx.fill();
    ctx.strokeStyle = primary ? '#d5b273aa' : 'rgba(215,198,154,.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (action === 'attack') {
      text('⚔', x, y, 19, '#f2e4bf', 'center', 500);
    } else if (action === 'interact') {
      text('✦', x, y, 17, '#f2e4bf', 'center', 500);
    } else {
      text(label, x, y + 1, 15, '#f2e4bf', 'center', 700);
    }
  }

  function drawControls() {
    const y = H - 102 - safe.b, cx = clamp(W * 0.16, 70 + safe.l, 128);
    ctx.globalAlpha = 0.92;
    control(cx, y, '↑', 'up', 21);
    control(cx - 43, y + 30, '←', 'left', 21);
    control(cx + 43, y + 30, '→', 'right', 21);
    control(cx, y + 60, '↓', 'down', 21);
    if (scene === 'village') {
      control(W - 58 - safe.r, y + 38, '', 'interact', 27, true);
    } else {
      control(W - 112 - safe.r, y + 22, '', 'attack', 26, true);
      control(W - 44 - safe.r, y + 50, '', 'interact', 26, true);
    }
    ctx.globalAlpha = 1;
    text('MOVE', cx, H - 13 - safe.b, 8, 'rgba(228,222,192,.9)', 'center', 700);
    text(scene === 'village' ? 'TALK · ENTER' : 'TAP TO STRIKE', W - safe.r - (scene === 'village' ? 58 : 79), H - 13 - safe.b, 8, 'rgba(228,222,192,.9)', 'center', 700);
  }

  function draw() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (live) update(dt);
    state.time = now / 1000;
    ctx.clearRect(0, 0, W, H);
    const t = state.time;
    if (scene === 'village') drawVillage(t); else drawDungeon(t);
    drawHud();
    drawControls();
    if (live) requestAnimationFrame(draw);
  }

  /* ---------------- update ---------------- */

  function update(dt) {
    const h = state.hero, p = playfield();
    h.attack = Math.max(0, h.attack - dt);
    h.invuln = Math.max(0, h.invuln - dt);
    let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      h.x += (dx / n) * 150 * dt;
      h.y += (dy / n) * 150 * dt;
      if (dx) h.dir = dx > 0 ? 1 : -1;
      h.step += dt;
    }
    h.x = clamp(h.x, p.left + 16, p.right - 16);
    h.y = clamp(h.y, p.top + 34, p.bottom - 8);
    if (scene === 'village') updateVillage(dt);
    else updateDungeon(dt);
    state.floaters.forEach((f) => { f.life -= dt; f.y -= 10 * dt; });
    state.floaters = state.floaters.filter((f) => f.life > 0);
    if (h.hp <= 0) {
      h.hp = h.max;
      h.x = W * 0.45; h.y = H * 0.7;
      scene = 'village';
      state.key = false;
      state.slimes = [];
      state.shots = [];
      toastMsg('Your companions carried you home. The ruin waits.');
      layoutAfterScene();
    }
  }

  function updateVillage(dt) {
    if (state.treeRespawn > 0) {
      state.treeRespawn -= dt;
      if (state.treeRespawn <= 0) state.treeCharges = [3, 3, 3, 3];
    }
    if (state.campTimer > 0) state.campTimer -= dt;
  }

  function updateDungeon(dt) {
    const h = state.hero, p = playfield();
    const top = p.top + 10, bot = p.bottom - 14;
    h.x = clamp(h.x, 28, W - 28);
    h.y = clamp(h.y, top + 44, bot - 6);
    const kp = keyPos();
    if (!state.key && dist(h.x, h.y, kp.x, kp.y) < 36) takeKey();
    state.slimes.forEach((e) => {
      if (e.hp <= 0) return;
      e.hit = Math.max(0, e.hit - dt);
      const d = dist(h.x, h.y, e.x, e.y);
      if (d > 26) {
        e.x += ((h.x - e.x) / d) * 34 * dt;
        e.y += ((h.y - e.y) / d) * 34 * dt;
      }
      e.cool -= dt;
      if (d < 28 && e.cool <= 0) { damageHero(1); e.cool = 1.6; }
      e.x = clamp(e.x, 30, W - 30);
      e.y = clamp(e.y, top + 40, bot - 6);
    });
    const b = state.boss;
    if (state.key && b.hp > 0) {
      b.attack -= dt; b.fire -= dt;
      const d = dist(h.x, h.y, b.x, b.y);
      if (d < 58 && b.attack <= 0) { damageHero(1); b.attack = 1.9; }
      if (b.fire <= 0 && d < 520) {
        const a = Math.atan2(h.y - b.y, h.x - b.x);
        state.shots.push({ x: b.x, y: b.y - 8, vx: Math.cos(a) * 105, vy: Math.sin(a) * 105, life: 3 });
        b.fire = 2.4;
      }
      if (state.key && b.hp <= 0) victory();
    }
    state.shots.forEach((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (dist(s.x, s.y, h.x, h.y) < 17 && s.life > 0) { damageHero(1); s.life = 0; }
    });
    state.shots = state.shots.filter((s) => s.life > 0 && s.x > 8 && s.x < W - 8 && s.y > p.top && s.y < p.bottom);
    // archer support
    const archers = state.people.filter((x) => x.job === 'Archer').length;
    if (archers > 0) {
      state.archerTick = (state.archerTick || 0) - dt;
      if (state.archerTick <= 0) {
        const targets = state.slimes.filter((e) => e.hp > 0);
        let target = targets[0];
        if (!target && state.key && b.hp > 0) target = b;
        if (target) {
          target.hp = Math.max(0, target.hp - (target === b ? 0.75 : 1) * (1 + (archers - 1) * 0.3));
          target.hit = 0.18;
          floatText(target.x, target.y - 26, '➶', '#b9d88a');
          if (target === b && target.hp <= 0) victory();
        }
        state.archerTick = 1.35;
      }
    }
    b.hp = Math.max(0, b.hp);
  }

  function damageHero(n) {
    const h = state.hero;
    if (h.invuln > 0 || state.won) return;
    h.hp -= n;
    h.invuln = 1.1;
    document.body.classList.add('hurt');
    setTimeout(() => document.body.classList.remove('hurt'), 130);
    if (h.hp <= 0) toastMsg('The ruin sends you back to the village…');
  }

  function attack() {
    if (!live) return;
    if (scene !== 'dungeon') { toastMsg('TAP THE GLOWING TREES TO GATHER COINS'); return; }
    if (state.hero.attack > 0) return;
    state.hero.attack = 0.42;
    if (!state.key) { toastMsg('The warden is sealed. Find the old key!'); return; }
    const h = state.hero;
    let target = null, best = 94;
    state.slimes.forEach((e) => { if (e.hp > 0) { const d = dist(e.x, e.y, h.x, h.y); if (d < best) { best = d; target = e; } } });
    const b = state.boss;
    if (b.hp > 0) {
      const d = dist(b.x, b.y, h.x, h.y);
      if (d < best + 8) { best = d; target = b; }
    }
    if (!target) { toastMsg('Move closer to a creature to strike.'); return; }
    const swords = state.people.filter((p) => p.job === 'Swordsman').length;
    target.hp = Math.max(0, target.hp - (target === b ? 1.3 + swords * 0.45 : 2 + swords * 0.6));
    target.hit = 0.2;
    floatText(target.x, target.y - 26, '-' + (target === b ? (1.3 + swords * 0.45).toFixed(1) : (2 + swords * 0.6)), '#ffd88b');
    if (target === b && target.hp <= 0) victory();
  }

  function takeKey() {
    if (state.key) return;
    state.key = true;
    state.boss.awake = true;
    state.boss.fire = 1.2;
    floatText(state.hero.x, state.hero.y - 40, 'THE OLD KEY', '#ffe39a');
    toastMsg('The old key hums. The warden wakes!');
  }

  function victory() {
    if (state.won) return;
    state.won = true;
    state.boss.hp = 0;
    live = false;
    const stats = document.getElementById('win-stats');
    if (stats) stats.textContent = `GUILD OF ${state.people.length} · ${state.coins} OLD COINS`;
    setTimeout(() => document.getElementById('win-screen').classList.remove('hidden'), 750);
  }

  /* ---------------- scene actions ---------------- */

  function treeAt(x, y) {
    const p = playfield();
    for (let i = 0; i < trees.length; i++) {
      const tx = W * trees[i].x, ty = p.top + (p.bottom - p.top) * trees[i].y;
      if (dist(x, y, tx, ty) < 42 * trees[i].big * viewScale()) return i;
    }
    return -1;
  }

  function gatherTree(i) {
    const p = playfield();
    const tx = W * trees[i].x, ty = p.top + (p.bottom - p.top) * trees[i].y;
    const group = i;
    if (state.treeCharges[group] > 0) {
      state.treeCharges[group]--;
      state.coins++;
      floatText(tx, ty - 34, '+1 OLD COIN');
      toastMsg(`You pried an old coin from the bark · ${state.coins} gathered`);
      if (state.treeCharges.every((n) => n === 0)) state.treeRespawn = 14;
    } else {
      toastMsg('That tree is bare. Another will have coins.');
    }
  }

  function visitCamp() {
    if (state.people.length >= 3) { openJobs(); return; }
    if (state.campTimer > 0) { toastMsg('The fire is warm. Someone may be near.'); return; }
    const p = playfield();
    const name = names[state.people.length];
    state.people.push({ name, job: 'Builder' });
    recalcHearts();
    state.campTimer = 1.1;
    floatText(W * 0.78, p.top + (p.bottom - p.top) * 0.68 - 80, name + ' JOINS');
    toastMsg(`You found ${name}, with no roof overhead. Welcome home.`);
    renderPeople();
    if (state.people.length === 1) setTimeout(openJobs, 520);
  }

  function openJobs() { renderPeople(); toast.classList.remove('show'); panel.classList.remove('hidden'); }

  function renderPeople() {
    peopleList.innerHTML = '';
    state.people.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'person-row';
      row.innerHTML = `<div class="person-icon">${icons[i]}</div><div class="person-copy"><strong>${p.name}</strong><small>From the campfire</small></div><select aria-label="${p.name}'s job"><option ${p.job === 'Archer' ? 'selected' : ''}>Archer</option><option ${p.job === 'Swordsman' ? 'selected' : ''}>Swordsman</option><option ${p.job === 'Builder' ? 'selected' : ''}>Builder</option></select><div class="job-desc">${jobInfo[p.job]}</div>`;
      row.querySelector('select').addEventListener('change', (e) => {
        p.job = e.target.value;
        recalcHearts();
        row.querySelector('.job-desc').textContent = jobInfo[p.job];
        toastMsg(`${p.name} is now a ${p.job.toLowerCase()}.`);
      });
      peopleList.appendChild(row);
    });
    if (!state.people.length) peopleList.innerHTML = '<p class="panel-empty">Tap the campfire to invite your first traveler.</p>';
    const roster = document.getElementById('job-roster');
    if (roster) roster.innerHTML = `<span class="job-name"><i class="job-mark a">A</i>Archer</span><em>${jobInfo.Archer}</em><span class="job-name"><i class="job-mark s">S</i>Swordsman</span><em>${jobInfo.Swordsman}</em><span class="job-name"><i class="job-mark b">B</i>Builder</span><em>${jobInfo.Builder}</em>`;
  }

  function recalcHearts() {
    const builders = state.people.filter((p) => p.job === 'Builder').length;
    const wasMax = state.hero.max;
    state.hero.max = 5 + builders;
    state.hero.hp = clamp(state.hero.hp + Math.max(0, state.hero.max - wasMax), 1, state.hero.max);
  }

  function enterDungeon() {
    if (state.coins < 6) { toastMsg(`The ruin needs 6 old coins. You have ${state.coins}.`); return; }
    scene = 'dungeon';
    state.key = false;
    state.won = false;
    state.shots = [];
    state.slimes = [
      { x: W * 0.42, y: H * 0.48, hp: 3, cool: 1.2, hit: 0 },
      { x: W * 0.68, y: H * 0.56, hp: 3, cool: 1.8, hit: 0 },
    ];
    state.boss = { x: W * 0.5, y: 0, hp: 9, max: 9, awake: false, attack: 0, fire: 0 };
    placeDungeon();
    state.hero.x = W * 0.5;
    state.hero.y = playfield().bottom - 30;
    state.hero.attack = 0;
    state.hero.invuln = 0;
    layoutAfterScene();
    toastMsg('One room. One key. One very sleepy warden.');
  }

  function layoutAfterScene() {
    const p = playfield();
    state.hero.x = clamp(state.hero.x, p.left + 16, p.right - 16);
    state.hero.y = clamp(state.hero.y, p.top + 40, p.bottom - 8);
  }

  function interact() {
    if (scene === 'village') {
      const v = village();
      if (dist(state.hero.x, state.hero.y, v.gate.x, v.gate.y) < 84 * viewScale()) enterDungeon();
      else if (dist(state.hero.x, state.hero.y, v.camp.x, v.camp.y) < 88 * viewScale()) visitCamp();
      else openJobs();
    } else {
      const p = playfield();
      const kp = keyPos();
      if (!state.key && dist(state.hero.x, state.hero.y, kp.x, kp.y) < 84) takeKey();
      else attack();
    }
  }

  /* ---------------- input ---------------- */

  function controlAt(x, y) {
    const y0 = H - 102 - safe.b, cx = clamp(W * 0.16, 70 + safe.l, 128);
    if (scene === 'village') return dist(x, y, W - 58 - safe.r, y0 + 38) < 36 ? 'interact' : null;
    const items = [
      ['up', cx, y0, 21], ['left', cx - 43, y0 + 30, 21], ['right', cx + 43, y0 + 30, 21], ['down', cx, y0 + 60, 21],
      ['attack', W - 112 - safe.r, y0 + 22, 27], ['interact', W - 44 - safe.r, y0 + 50, 27],
    ];
    const hit = items.find(([, a, b, r]) => dist(x, y, a, b) < r + 9);
    return hit ? hit[0] : null;
  }

  function hudJobsAt(x, y) {
    if (scene !== 'village' || y < 10 + safe.t || y > 58 + safe.t) return false;
    const jobsW = 58, peopleW = 40, coinW = 66, gap = 4;
    const startX = W - 9 - safe.r - (jobsW + peopleW + coinW + gap * 2);
    return x >= startX + coinW + peopleW + gap * 2 - 2;
  }

  function canvasTap(x, y) {
    if (scene === 'village') {
      if (hudJobsAt(x, y)) { openJobs(); return; }
      const v = village();
      const i = treeAt(x, y);
      if (i >= 0) { gatherTree(i); return; }
      if (dist(x, y, v.camp.x, v.camp.y) < 78 * viewScale()) { visitCamp(); return; }
      if (dist(x, y, v.gate.x, v.gate.y) < 66 * viewScale()) { enterDungeon(); return; }
      if (dist(x, y, W * 0.85, playfield().top + 24) < 44) { openJobs(); return; }
      // tap to step toward a point (keeps the village explorable)
      const d = dist(x, y, state.hero.x, state.hero.y);
      if (d > 26) {
        state.hero.x += (x - state.hero.x) * 0.35;
        state.hero.y += (y - state.hero.y) * 0.35;
        state.hero.x = clamp(state.hero.x, playfield().left + 16, playfield().right - 16);
        state.hero.y = clamp(state.hero.y, playfield().top + 34, playfield().bottom - 8);
      }
    } else {
      const p = playfield();
      const kp = keyPos();
      if (!state.key && dist(x, y, kp.x, kp.y) < 48) {
        state.hero.x = kp.x; state.hero.y = kp.y + 30;
        takeKey();
        return;
      }
      const d = dist(x, y, state.hero.x, state.hero.y);
      if (d > 34) {
        state.hero.x += (x - state.hero.x) * 0.4;
        state.hero.y += (y - state.hero.y) * 0.4;
        state.hero.x = clamp(state.hero.x, 28, W - 28);
        state.hero.y = clamp(state.hero.y, p.top + 54, p.bottom - 20);
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const action = controlAt(x, y);
    canvas.setPointerCapture?.(e.pointerId);
    if (action) {
      pointer = { action, id: e.pointerId };
      if (['up', 'down', 'left', 'right'].includes(action)) held[action] = true;
      else if (action === 'attack') attack();
      else interact();
      return;
    }
    canvasTap(x, y);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (pointer && pointer.id === e.pointerId) { held[pointer.action] = false; pointer = null; }
  });
  canvas.addEventListener('pointercancel', () => {
    if (pointer) held[pointer.action] = false;
    pointer = null;
  });

  const keys = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (keys[k] || k === ' ') e.preventDefault();
    if (keys[k]) held[keys[k]] = true;
    if (k === ' ' || k === 'j') attack();
    if (k === 'e' || k === 'enter') interact();
    if (k === 'escape') panel.classList.add('hidden');
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys[k]) held[keys[k]] = false;
  });

  panel.querySelector('.close').addEventListener('click', () => panel.classList.add('hidden'));
  document.getElementById('start-button').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    live = true;
    last = performance.now();
    requestAnimationFrame(draw);
    toastMsg('Tap a glowing tree for old coins, then visit the campfire.');
  });
  document.getElementById('again-button').addEventListener('click', () => location.reload());
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);

  resize();
  renderPeople();
  draw();
})();
