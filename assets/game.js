/* Dragon Run — dependency-free canvas mini-game */
(() => {
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = 960;
  const H = 440;

  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovText = document.getElementById("ovText");
  const startBtn = document.getElementById("startBtn");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const coinsEl = document.getElementById("coins");
  const muteBtn = document.getElementById("muteBtn");

  const BEST_KEY = "dikzzy.dragonrun.best";
  const MUTE_KEY = "dikzzy.dragonrun.muted";

  /* ---------------- state ---------------- */
  const state = {
    mode: "idle",
    score: 0,
    coins: 0,
    best: 0,
    t: 0,
    speed: 235,
    spawnTimer: 0,
    spawnEvery: 1.55,
    muted: false,
  };

  const player = { x: 150, y: H / 2, vy: 0, r: 19, rot: 0 };
  const GRAVITY = 1520;
  const FLAP = -430;
  const MAX_FALL = 720;

  let obstacles = [];
  let coins = [];
  let particles = [];
  let stars = [];

  for (let i = 0; i < 46; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, a: Math.random() * 0.45 + 0.12 });
  }

  /* ---------------- audio ---------------- */
  let actx = null;
  function audio() {
    if (state.muted) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function blip(freq, dur, type, gain) {
    const ac = audio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.07, ac.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  }
  const sfx = {
    flap: () => blip(420, 0.09, "triangle", 0.05),
    coin: () => { blip(880, 0.08, "square", 0.05); setTimeout(() => blip(1240, 0.1, "square", 0.04), 55); },
    hit: () => { blip(180, 0.22, "sawtooth", 0.09); setTimeout(() => blip(110, 0.3, "sawtooth", 0.07), 90); },
    start: () => { blip(560, 0.1, "triangle", 0.05); setTimeout(() => blip(760, 0.12, "triangle", 0.05), 90); },
  };

  /* ---------------- helpers ---------------- */
  function best() {
    try { return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch {}
  }
  function syncHud() {
    scoreEl.textContent = String(state.score);
    coinsEl.textContent = String(state.coins);
    bestEl.textContent = String(state.best);
  }

  function reset() {
    obstacles = [];
    coins = [];
    particles = [];
    player.y = H / 2;
    player.vy = 0;
    player.rot = 0;
    state.score = 0;
    state.coins = 0;
    state.t = 0;
    state.speed = 235;
    state.spawnTimer = 0;
    state.spawnEvery = 1.55;
    syncHud();
  }

  function flap() {
    if (state.mode !== "playing") return;
    player.vy = FLAP;
    player.rot = -0.42;
    sfx.flap();
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: player.x - 12, y: player.y + 6,
        vx: -90 - Math.random() * 130, vy: (Math.random() - 0.5) * 130,
        life: 0.45, max: 0.45, size: 2 + Math.random() * 2.4, hue: 78,
      });
    }
  }

  function start() {
    reset();
    state.mode = "playing";
    overlay.hidden = true;
    sfx.start();
    player.vy = FLAP * 0.7;
  }

  function gameOver() {
    state.mode = "over";
    sfx.hit();
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
      ovTitle.textContent = "New best! 🏆";
    } else {
      ovTitle.textContent = "Ouch. 💀";
    }
    ovText.innerHTML = `Score <strong>${state.score}</strong> · Coins <strong>${state.coins}</strong><br />Best <strong>${state.best}</strong>`;
    startBtn.textContent = "Play again";
    overlay.hidden = false;
    syncHud();
    for (let i = 0; i < 26; i++) {
      particles.push({
        x: player.x, y: player.y,
        vx: (Math.random() - 0.5) * 380, vy: (Math.random() - 0.5) * 380,
        life: 0.8, max: 0.8, size: 2 + Math.random() * 3.6, hue: 18,
      });
    }
  }

  /* ---------------- spawning ---------------- */
  function spawnObstacle() {
    const gapH = Math.max(132, 196 - state.score * 1.15);
    const margin = 54;
    const gapY = margin + Math.random() * (H - gapH - margin * 2);
    obstacles.push({ x: W + 60, gapY, gapH, passed: false, wobble: Math.random() * Math.PI * 2 });

    if (Math.random() < 0.62) {
      coins.push({
        x: W + 60, y: gapY + gapH / 2, r: 9, taken: false,
        spin: Math.random() * Math.PI * 2,
      });
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    state.t += dt;

    for (const s of stars) {
      s.x -= state.speed * 0.055 * dt;
      if (s.x < -3) { s.x = W + 3; s.y = Math.random() * H; }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (state.mode !== "playing") return;

    player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL);
    player.y += player.vy * dt;
    player.rot += ((-Math.atan2(player.vy, 520)) - player.rot) * Math.min(1, dt * 9);

    state.speed = 235 + Math.min(240, state.score * 3.1);
    state.spawnTimer += dt;
    const every = Math.max(0.92, state.spawnEvery - state.score * 0.012);
    if (state.spawnTimer >= every) {
      state.spawnTimer = 0;
      spawnObstacle();
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= state.speed * dt;

      const nearX = Math.abs(o.x + 34 - player.x) < 34 + player.r;
      if (nearX) {
        const topEdge = o.gapY;
        const botEdge = o.gapY + o.gapH;
        if (player.y - player.r < topEdge || player.y + player.r > botEdge) {
          gameOver();
          return;
        }
      }

      if (!o.passed && o.x + 34 < player.x - player.r) {
        o.passed = true;
        state.score += 1;
        syncHud();
      }
      if (o.x < -110) obstacles.splice(i, 1);
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= state.speed * dt;
      c.spin += dt * 3.4;
      const dx = c.x - player.x;
      const dy = c.y - player.y;
      if (!c.taken && dx * dx + dy * dy < (player.r + c.r + 4) ** 2) {
        c.taken = true;
        state.coins += 1;
        state.score += 3;
        sfx.coin();
        syncHud();
        for (let k = 0; k < 10; k++) {
          particles.push({
            x: c.x, y: c.y,
            vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220,
            life: 0.5, max: 0.5, size: 1.8 + Math.random() * 2.6, hue: 74,
          });
        }
      }
      if (c.x < -30) coins.splice(i, 1);
    }

    if (player.y - player.r < -10 || player.y + player.r > H + 10) {
      player.y = Math.max(player.r, Math.min(H - player.r, player.y));
      gameOver();
    }
  }

  /* ---------------- render ---------------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#08110c");
    g.addColorStop(0.55, "#060a07");
    g.addColorStop(1, "#040705");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#a3ff12";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(163,255,18,0.06)";
    ctx.lineWidth = 1;
    const offset = (state.t * state.speed * 0.35) % 80;
    for (let x = -offset; x < W; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  function drawObstacle(o) {
    const w = 68;
    const topH = o.gapY;
    const botY = o.gapY + o.gapH;
    const botH = H - botY;

    const grad = ctx.createLinearGradient(o.x, 0, o.x + w, 0);
    grad.addColorStop(0, "rgba(120,160,130,0.10)");
    grad.addColorStop(0.5, "rgba(163,255,18,0.20)");
    grad.addColorStop(1, "rgba(120,160,130,0.10)");

    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(163,255,18,0.42)";
    ctx.lineWidth = 1.6;

    roundRect(o.x, -18, w, topH + 18, 10);
    ctx.fill();
    ctx.stroke();

    roundRect(o.x, botY, w, botH + 18, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(163,255,18,0.55)";
    ctx.fillRect(o.x - 3, topH - 7, w + 6, 5);
    ctx.fillRect(o.x - 3, botY + 2, w + 6, 5);
  }

  function drawCoin(c) {
    const sx = Math.abs(Math.cos(c.spin));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(0.35 + sx * 0.65, 1);
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = "#a3ff12";
    ctx.shadowColor = "rgba(163,255,18,0.85)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = "#0a1a06";
    ctx.fill();
    ctx.restore();
  }

  function drawDragon() {
    const { x, y, r, rot } = player;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // wings
    const wing = Math.sin(state.t * 13) * 0.34;
    ctx.fillStyle = "rgba(163,255,18,0.72)";
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(-26, -18 - wing * 22);
    ctx.lineTo(-14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 6);
    ctx.lineTo(-24, 22 + wing * 18);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();

    // body
    const bodyGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, r + 5);
    bodyGrad.addColorStop(0, "#3d4650");
    bodyGrad.addColorStop(1, "#171d22");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(163,255,18,0.55)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // head
    ctx.fillStyle = "#20272e";
    ctx.beginPath();
    ctx.ellipse(11, -4, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(163,255,18,0.5)";
    ctx.stroke();

    // horn
    ctx.fillStyle = "#a3ff12";
    ctx.beginPath();
    ctx.moveTo(8, -13);
    ctx.lineTo(12, -24);
    ctx.lineTo(17, -12);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.beginPath();
    ctx.arc(16, -6, 3.1, 0, Math.PI * 2);
    ctx.fillStyle = "#a3ff12";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(17.2, -6, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = "#04120a";
    ctx.fill();

    // snout
    ctx.fillStyle = "#a3ff12";
    ctx.beginPath();
    ctx.moveTo(22, -3);
    ctx.lineTo(30, -1);
    ctx.lineTo(22, 2);
    ctx.closePath();
    ctx.fill();

    // tail
    ctx.strokeStyle = "rgba(163,255,18,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r + 3, 4);
    ctx.quadraticCurveTo(-r - 12, 12 + Math.sin(state.t * 7) * 6, -r - 20, 2 + Math.sin(state.t * 7) * 9);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.hue > 40 ? "#a3ff12" : "#ff7a3d";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();
    for (const o of obstacles) drawObstacle(o);
    for (const c of coins) if (!c.taken) drawCoin(c);
    drawParticles();
    if (state.mode !== "over") drawDragon();
  }

  /* ---------------- loop ---------------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ---------------- input ---------------- */
  function handleAction(e) {
    if (e) e.preventDefault();
    if (state.mode === "playing") flap();
    else if (state.mode === "idle" || state.mode === "over") start();
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.key === "w" || e.key === "W") {
      if (document.activeElement === startBtn) return;
      handleAction(e);
    }
  }, { passive: false });

  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); handleAction(e); });
  startBtn.addEventListener("click", (e) => { e.preventDefault(); handleAction(e); });

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    try { localStorage.setItem(MUTE_KEY, state.muted ? "1" : "0"); } catch {}
    muteBtn.textContent = state.muted ? "🔇 Sound off" : "🔊 Sound on";
    muteBtn.setAttribute("aria-pressed", String(state.muted));
    if (!state.muted) sfx.start();
  });

  /* ---------------- init ---------------- */
  state.best = best();
  try {
    state.muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
  muteBtn.textContent = state.muted ? "🔇 Sound off" : "🔊 Sound on";
  muteBtn.setAttribute("aria-pressed", String(state.muted));

  reset();
  render();
  requestAnimationFrame(loop);
})();
