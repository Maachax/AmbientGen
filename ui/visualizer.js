// ============================================================
// Visualizer — Ambient Room
// ============================================================
// Minimal HUD overlay: voice activity, current chord/scale, BPM,
// and a peak meter bar along the bottom edge.
// Driven by engine events; uses requestAnimationFrame for the meter.

const VOICE_LABELS = {
  deepBass: "bass",
  pad: "pad",
  glass: "glass",
  pulse: "pulse",
  drift: "drift",
  shimmer: "shimmer",
};

const VOICE_ORDER = ["deepBass", "pad", "glass", "pulse", "drift", "shimmer"];

export function createVisualizer(engine) {
  // ========================
  // DOM
  // ========================
  const style = document.createElement("style");
  style.textContent = `
    #ar-hud {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 60px;
      background: rgba(8, 8, 12, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      padding: 0 36px;
      gap: 40px;
      pointer-events: none;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
      z-index: 100;
    }
    #ar-voices {
      display: flex;
      gap: 20px;
      flex-shrink: 0;
    }
    .ar-voice {
      font-size: 9px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.12);
      transition: color 2s ease, text-shadow 2s ease;
      user-select: none;
    }
    .ar-voice.active {
      color: rgba(200, 220, 255, 0.72);
      text-shadow: 0 0 14px rgba(160, 190, 255, 0.5);
    }
    #ar-harmony {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      min-width: 0;
    }
    #ar-chord {
      font-size: 18px;
      font-weight: 200;
      letter-spacing: 5px;
      color: rgba(255, 255, 255, 0.65);
      transition: color 0.6s ease;
    }
    #ar-scale {
      font-size: 9px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.2);
      transition: color 1s ease;
    }
    #ar-bpm {
      font-size: 10px;
      letter-spacing: 2px;
      color: rgba(255, 255, 255, 0.18);
      flex-shrink: 0;
      min-width: 52px;
      text-align: right;
    }
    #ar-meter {
      position: absolute;
      bottom: 0; left: 0;
      width: 100%;
      height: 2px;
      display: block;
    }
  `;
  document.head.appendChild(style);

  const hud = document.createElement("div");
  hud.id = "ar-hud";
  hud.innerHTML = `
    <div id="ar-voices">
      ${VOICE_ORDER.map((name) => `<span class="ar-voice" data-name="${name}">${VOICE_LABELS[name]}</span>`).join("")}
    </div>
    <div id="ar-harmony">
      <span id="ar-chord">—</span>
      <span id="ar-scale">—</span>
    </div>
    <div id="ar-bpm">—</div>
    <canvas id="ar-meter" height="2"></canvas>
  `;
  document.body.appendChild(hud);

  // ========================
  // ELEMENT REFS
  // ========================
  const voiceEls = {};
  hud.querySelectorAll(".ar-voice").forEach((el) => {
    voiceEls[el.dataset.name] = el;
  });
  const chordEl = document.getElementById("ar-chord");
  const scaleEl = document.getElementById("ar-scale");
  const bpmEl = document.getElementById("ar-bpm");
  const meterCanvas = document.getElementById("ar-meter");
  const ctx = meterCanvas.getContext("2d");

  // ========================
  // ENGINE EVENT LISTENERS
  // ========================
  engine.on("chord-change", ({ chord }) => {
    chordEl.textContent = chord;
  });

  engine.on("scale-change", ({ note, mode }) => {
    scaleEl.textContent = `${note} ${mode}`;
  });

  engine.on("voice-fade-in", (name) => {
    if (voiceEls[name]) voiceEls[name].classList.add("active");
  });

  engine.on("voice-fade-out", (name) => {
    if (voiceEls[name]) voiceEls[name].classList.remove("active");
  });

  // ========================
  // RAF LOOP
  // ========================
  let running = false;
  let bpmTick = 0;

  function drawMeter() {
    const level = engine.getAudioGraph().meter.getValue();
    const db = typeof level === "number" ? level : -Infinity;
    const normalized = Math.max(0, Math.min(1, (db + 60) / 60));

    const w = meterCanvas.offsetWidth || hud.offsetWidth;
    if (meterCanvas.width !== w) meterCanvas.width = w;

    ctx.clearRect(0, 0, w, 2);
    if (normalized > 0) {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(100, 140, 255, 0.35)");
      grad.addColorStop(0.6, "rgba(140, 180, 255, 0.45)");
      grad.addColorStop(1, "rgba(220, 180, 120, 0.5)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w * normalized, 2);
    }
  }

  function loop() {
    if (!running) return;
    drawMeter();
    if (++bpmTick % 20 === 0) {
      bpmEl.textContent = `${Math.round(engine.getBpm())} bpm`;
    }
    requestAnimationFrame(loop);
  }

  // ========================
  // PUBLIC API
  // ========================
  function start() {
    running = true;

    // Seed initial state from engine
    const state = engine.getState();
    chordEl.textContent = state.currentChord || "—";
    scaleEl.textContent = `${state.scale.note} ${state.scale.mode}`;
    bpmEl.textContent = `${Math.round(state.bpm)} bpm`;

    for (const v of state.voices) {
      if (v.active && voiceEls[v.name]) voiceEls[v.name].classList.add("active");
    }

    requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
  }

  return { start, stop };
}
