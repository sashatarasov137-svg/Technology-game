/* ============================================================
   app.js — the app itself
   ------------------------------------------------------------
   This file connects everything: it draws the parts on screen,
   listens for clicks and drags, runs the simulation many times
   a second, and updates what you see.
   ============================================================ */

const SAVE_KEY = 'sparklab.v1';

/* Everything the app knows, in one place. Change this and the
   screen redraws to match — that is the whole design. */
const state = {
  parts: [],            // what is on the bench
  wires: [],            // what is joined to what
  nextId: 1,
  armedLeg: null,       // the leg waiting for a partner, after one click
  completed: new Set(), // ids of finished challenges
  soundOn: true,
  memory: freshMemory()
};

/* Shortcuts to the bits of the page we keep touching. */
const el = {
  bench:       document.getElementById('bench'),
  partsLayer:  document.getElementById('partsLayer'),
  wireLayer:   document.getElementById('wireLayer'),
  benchEmpty:  document.getElementById('benchEmpty'),
  palette:     document.getElementById('palette'),
  statusText:  document.getElementById('statusText'),
  statusBar:   document.getElementById('statusBar'),
  readoutBody: document.getElementById('readoutBody'),
  challengeList: document.getElementById('challengeList'),
  progressFill:  document.getElementById('progressFill'),
  progressText:  document.getElementById('progressText')
};

const partEls = new Map();   // partId -> its <div> on screen


/* ============================================================
   Adding, moving and removing parts
   ============================================================ */

function addPart(type) {
  const spec = PARTS[type];

  if (spec.unique && state.parts.some(p => p.type === type)) {
    flashStatus('You only need one ' + spec.name.toLowerCase() + '.');
    return;
  }

  const part = {
    id: 'p' + (state.nextId++),
    type,
    ...findFreeSpot(),
    state: {
      closed: !!spec.startsClosed,
      pressed: false,
      resistance: spec.resistance,
      valueIndex: spec.values ? Math.max(0, spec.values.indexOf(spec.resistance)) : 0
    }
  };
  state.parts.push(part);
  rebuildBench();
  save();
}

/* Drop new parts into the first empty slot on a loose grid so
   they never land on top of each other. */
function findFreeSpot() {
  const gapX = PART_W + 60, gapY = PART_H + 66;
  const cols = Math.max(1, Math.floor((el.bench.clientWidth - 40) / gapX));
  for (let i = 0; i < 60; i++) {
    const x = 30 + (i % cols) * gapX;
    const y = 28 + Math.floor(i / cols) * gapY;
    const taken = state.parts.some(p => Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 20);
    if (!taken) return { x, y };
  }
  return { x: 30, y: 28 };
}

function removePart(id) {
  state.parts = state.parts.filter(p => p.id !== id);
  state.wires = state.wires.filter(w => w.from.partId !== id && w.to.partId !== id);
  if (state.armedLeg && state.armedLeg.partId === id) state.armedLeg = null;
  rebuildBench();
  save();
}

function clearBench() {
  state.parts = [];
  state.wires = [];
  state.armedLeg = null;
  state.memory = freshMemory();
  rebuildBench();
  save();
}


/* ============================================================
   Wiring: click one leg, then click another
   ============================================================ */

function onLegClick(partId, legId) {
  const here = { partId, legId };

  if (!state.armedLeg) {
    state.armedLeg = here;
  } else if (state.armedLeg.partId === partId && state.armedLeg.legId === legId) {
    state.armedLeg = null;                       // clicked the same leg: cancel
  } else {
    const from = state.armedLeg;
    const exists = state.wires.some(w => sameLeg(w.from, from) && sameLeg(w.to, here)
                                      || sameLeg(w.from, here) && sameLeg(w.to, from));
    if (!exists) {
      state.wires.push({ id: 'w' + (state.nextId++), from, to: here });
      rebuildWires();
      save();
    }
    state.armedLeg = null;
  }
  refreshLegHighlights();
}

const sameLeg = (a, b) => a.partId === b.partId && a.legId === b.legId;

function removeWire(id) {
  state.wires = state.wires.filter(w => w.id !== id);
  rebuildWires();
  save();
}


/* ============================================================
   Drawing the bench
   ============================================================ */

function rebuildBench() {
  el.partsLayer.innerHTML = '';
  partEls.clear();
  state.parts.forEach(createPartElement);
  el.benchEmpty.classList.toggle('hidden', state.parts.length > 0);
  rebuildWires();
  refreshLegHighlights();
}

function createPartElement(part) {
  const spec = PARTS[part.type];

  const node = document.createElement('div');
  node.className = 'part part-' + part.type;
  node.style.left = part.x + 'px';
  node.style.top  = part.y + 'px';
  node.style.width  = PART_W + 'px';
  node.style.height = PART_H + 'px';
  node.dataset.id = part.id;

  node.innerHTML = `
    <svg class="part-art" viewBox="0 0 ${PART_W} ${PART_H}">${spec.art}</svg>
    <div class="part-label">${spec.name}</div>
    <button class="part-del" title="Remove">&times;</button>
  `;

  // Legs — the little circles you click to start a wire.
  for (const leg of spec.legs) {
    const dot = document.createElement('button');
    dot.className = 'leg-dot' + (leg.label ? ' leg-' + (leg.polarity || leg.role || '') : '');
    dot.style.left = leg.x + 'px';
    dot.style.top  = leg.y + 'px';
    dot.dataset.leg = leg.id;
    dot.title = leg.label ? 'Leg ' + leg.label : 'Leg';
    if (leg.label) dot.innerHTML = `<span class="leg-label">${leg.label}</span>`;
    dot.addEventListener('pointerdown', e => e.stopPropagation());
    dot.addEventListener('click', e => { e.stopPropagation(); onLegClick(part.id, leg.id); });
    node.appendChild(dot);
  }

  // A readable value badge on the parts that have one.
  if (spec.values || spec.variable) {
    const badge = document.createElement('div');
    badge.className = 'part-value';
    node.appendChild(badge);
  }

  // The dial gets a slider you can drag.
  if (spec.variable) {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'pot-slider';
    slider.min = spec.minR; slider.max = spec.maxR; slider.step = 50;
    slider.value = part.state.resistance;
    slider.addEventListener('pointerdown', e => e.stopPropagation());
    slider.addEventListener('input', () => {
      part.state.resistance = Number(slider.value);
      save();
    });
    node.appendChild(slider);
  }

  node.querySelector('.part-del').addEventListener('pointerdown', e => e.stopPropagation());
  node.querySelector('.part-del').addEventListener('click', e => {
    e.stopPropagation();
    removePart(part.id);
  });

  attachDragAndPress(node, part, spec);

  el.partsLayer.appendChild(node);
  partEls.set(part.id, node);
}

/* One handler covers three things, because they all start with
   pressing on a part: dragging it, holding a push button down,
   and plain clicking (which toggles a switch or changes a
   resistor's value). We tell them apart by whether the pointer
   moved before it was released. */
function attachDragAndPress(node, part, spec) {
  let dragging = false, moved = false, offX = 0, offY = 0;

  node.addEventListener('pointerdown', e => {
    const rect = el.bench.getBoundingClientRect();
    offX = e.clientX - rect.left - part.x;
    offY = e.clientY - rect.top  - part.y;
    dragging = true; moved = false;
    node.setPointerCapture(e.pointerId);
    node.classList.add('grabbing');
    if (spec.momentary) part.state.pressed = true;      // hold-to-close
  });

  node.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = el.bench.getBoundingClientRect();
    const nx = e.clientX - rect.left - offX;
    const ny = e.clientY - rect.top  - offY;
    if (!moved && Math.abs(nx - part.x) + Math.abs(ny - part.y) < 5) return;
    moved = true;
    if (spec.momentary) part.state.pressed = false;     // a drag is not a press
    part.x = clamp(nx, 4, el.bench.clientWidth  - PART_W - 4);
    part.y = clamp(ny, 4, el.bench.clientHeight - PART_H - 4);
    node.style.left = part.x + 'px';
    node.style.top  = part.y + 'px';
    drawWires();
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    node.classList.remove('grabbing');
    if (spec.momentary) part.state.pressed = false;
    if (!moved) onPartClick(part, spec);
    save();
  };
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
}

function onPartClick(part, spec) {
  if (spec.toggle) {
    part.state.closed = !part.state.closed;
  } else if (spec.values) {
    part.state.valueIndex = (part.state.valueIndex + 1) % spec.values.length;
    part.state.resistance = spec.values[part.state.valueIndex];
    flashStatus('Resistor set to ' + formatOhms(part.state.resistance) + '.');
  } else {
    flashStatus(spec.name + ': ' + spec.blurb);
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


/* --- wires ------------------------------------------------ */

function legPosition(partId, legId) {
  const part = state.parts.find(p => p.id === partId);
  if (!part) return null;
  const leg = PARTS[part.type].legs.find(l => l.id === legId);
  return { x: part.x + leg.x, y: part.y + leg.y };
}

/* Wires get built once, when one is added or removed. After that
   we only move them. Rebuilding them on every frame would mean
   the thing you are about to click is replaced underneath your
   cursor sixty times a second. */
const wireEls = new Map();   // wireId -> { hit, line }

function rebuildWires() {
  el.wireLayer.innerHTML = '';
  wireEls.clear();

  for (const wire of state.wires) {
    // A fat invisible line underneath, so wires are easy to click.
    const hit  = makePath('wire-hit');
    const line = makePath('wire');
    hit.addEventListener('click', () => removeWire(wire.id));
    el.wireLayer.append(hit, line);
    wireEls.set(wire.id, { hit, line });
  }
  drawWires();
}

function makePath(className) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', className);
  return path;
}

/* Recalculate where each wire hangs, and whether it is carrying
   current. Cheap enough to run on every frame. */
function drawWires(liveParts) {
  for (const wire of state.wires) {
    const els = wireEls.get(wire.id);
    if (!els) continue;

    const a = legPosition(wire.from.partId, wire.from.legId);
    const b = legPosition(wire.to.partId,   wire.to.legId);
    if (!a || !b) continue;

    // A gentle sag looks far more like a real wire than a
    // straight line does. The dip grows with distance.
    const dip = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
    const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + dip}, ${b.x} ${b.y + dip}, ${b.x} ${b.y}`;

    els.hit.setAttribute('d', d);
    els.line.setAttribute('d', d);

    const live = !!liveParts && liveParts.has(wire.from.partId) && liveParts.has(wire.to.partId);
    els.line.classList.toggle('wire-live', live);
  }
}

function refreshLegHighlights() {
  document.querySelectorAll('.leg-dot').forEach(dot => dot.classList.remove('armed'));
  if (!state.armedLeg) {
    el.bench.classList.remove('wiring');
    return;
  }
  el.bench.classList.add('wiring');
  const node = partEls.get(state.armedLeg.partId);
  if (node) {
    const dot = node.querySelector(`.leg-dot[data-leg="${state.armedLeg.legId}"]`);
    if (dot) dot.classList.add('armed');
  }
}


/* ============================================================
   The heartbeat: simulate, then show the result
   ============================================================ */

function tick() {
  const sim = simulate(state.parts, state.wires);
  observe(state.memory, state.parts, sim);
  paint(sim);
  updateReadout(sim);
  updateStatus(sim);
  updateChallenges(sim);
  updateSound(sim);
  requestAnimationFrame(tick);
}

/* Push the simulation result onto the screen. */
function paint(sim) {
  const liveParts = new Set();
  for (const loop of sim.loops) {
    if (loop.blockedBy.length === 0 && loop.current > 0) loop.partIds.forEach(id => liveParts.add(id));
  }
  if (sim.powered) {
    const battery = state.parts.find(p => p.type === 'battery');
    if (battery) liveParts.add(battery.id);
  }

  for (const part of state.parts) {
    const node = partEls.get(part.id);
    if (!node) continue;
    const st = sim.partState[part.id];

    node.classList.toggle('is-live', liveParts.has(part.id));
    node.classList.toggle('is-reversed', st.reversed);
    node.classList.toggle('is-overloaded', st.overloaded);

    if (part.type === 'led') {
      node.style.setProperty('--glow', st.brightness.toFixed(3));
      node.classList.toggle('lit', st.brightness > 0.05);
    }
    if (part.type === 'switch') {
      node.classList.toggle('closed', part.state.closed);
    }
    if (part.type === 'button') {
      node.classList.toggle('pressed', part.state.pressed);
    }
    if (part.type === 'motor') {
      node.classList.toggle('spinning', st.spinning > 0);
      // Faster current, faster spin: 1.2s at a crawl down to 0.15s flat out.
      node.style.setProperty('--spin', (1.2 - st.spinning * 1.05).toFixed(2) + 's');
    }
    if (part.type === 'buzzer') {
      node.classList.toggle('sounding', st.sounding);
    }

    const badge = node.querySelector('.part-value');
    if (badge) badge.textContent = formatOhms(part.state.resistance);
  }

  drawWires(liveParts);
}

function updateReadout(sim) {
  const rows = [];
  const battery = state.parts.find(p => p.type === 'battery');

  if (battery) rows.push(['Battery', '9 V']);

  const workingLoops = sim.loops.filter(l => l.blockedBy.length === 0 && l.current > 0);
  if (workingLoops.length) {
    rows.push(['Complete loops', String(workingLoops.length)]);
    const strongest = workingLoops.reduce((a, b) => a.current > b.current ? a : b);
    rows.push(['Loop resistance', formatOhms(strongest.resistance)]);
    rows.push(['Current', formatCurrent(strongest.current)]);
  }

  for (const part of state.parts) {
    const st = sim.partState[part.id];
    if (st.current > 0 && part.type !== 'battery') {
      rows.push([PARTS[part.type].name, formatCurrent(st.current)]);
    }
  }

  if (!rows.length) {
    el.readoutBody.innerHTML = '<p class="muted">Nothing connected yet.</p>';
    return;
  }
  el.readoutBody.innerHTML = rows
    .map(([k, v]) => `<div class="readout-row"><span>${k}</span><strong>${v}</strong></div>`)
    .join('');
}

let flashUntil = 0, flashMessage = '';

function flashStatus(text) {
  flashMessage = text;
  flashUntil = Date.now() + 2400;
}

function updateStatus(sim) {
  // Half-drawn wire? That is what the user needs to know right now.
  if (state.armedLeg) {
    el.statusText.textContent = 'Now click another leg to finish the wire. Press Esc to cancel.';
    el.statusBar.className = 'status-bar level-warn';
    return;
  }
  // Show the most serious thing first: danger, then warning, etc.
  const order = { danger: 0, warn: 1, info: 2, good: 3 };
  const issue = [...sim.issues].sort((a, b) => order[a.level] - order[b.level])[0];

  // A congratulation must never bury a warning that something is
  // burning out — the danger always wins.
  const danger = issue && issue.level === 'danger';

  if (!danger && Date.now() < flashUntil) {
    el.statusText.textContent = flashMessage;
    el.statusBar.className = 'status-bar level-info';
    return;
  }
  if (!issue) {
    el.statusText.textContent = 'Add a battery to get started.';
    el.statusBar.className = 'status-bar level-info';
    return;
  }
  el.statusText.textContent = issue.text;
  el.statusBar.className = 'status-bar level-' + issue.level;
}


/* ============================================================
   Challenges
   ============================================================ */

function buildChallengeList() {
  el.challengeList.innerHTML = '';
  CHALLENGES.forEach((ch, i) => {
    const li = document.createElement('li');
    li.className = 'challenge';
    li.dataset.id = ch.id;
    li.innerHTML = `
      <div class="challenge-head">
        <span class="challenge-tick">${i + 1}</span>
        <div>
          <h3>${ch.title}</h3>
          <p>${ch.brief}</p>
        </div>
      </div>
      <button class="hint-toggle">Show hint</button>
      <p class="hint hidden">${ch.hint}</p>`;
    const toggle = li.querySelector('.hint-toggle');
    const hint = li.querySelector('.hint');
    toggle.addEventListener('click', () => {
      hint.classList.toggle('hidden');
      toggle.textContent = hint.classList.contains('hidden') ? 'Show hint' : 'Hide hint';
    });
    el.challengeList.appendChild(li);
  });
}

function updateChallenges(sim) {
  let changed = false;

  for (const ch of CHALLENGES) {
    if (state.completed.has(ch.id)) continue;
    let done = false;
    try { done = !!ch.check(state.parts, sim, state.memory); } catch (err) { done = false; }
    if (done) {
      state.completed.add(ch.id);
      changed = true;
      celebrate(ch);
    }
  }

  for (const ch of CHALLENGES) {
    const li = el.challengeList.querySelector(`[data-id="${ch.id}"]`);
    if (li) li.classList.toggle('done', state.completed.has(ch.id));
  }

  const n = state.completed.size, total = CHALLENGES.length;
  el.progressFill.style.width = (n / total * 100) + '%';
  el.progressText.textContent = `${n} of ${total} complete`;

  if (changed) save();
}

function celebrate(ch) {
  flashStatus('✅ Challenge complete: ' + ch.title);
  const li = el.challengeList.querySelector(`[data-id="${ch.id}"]`);
  if (li) {
    li.classList.add('just-done');
    setTimeout(() => li.classList.remove('just-done'), 1400);
  }
}


/* ============================================================
   Sound — the buzzer
   ------------------------------------------------------------
   Browsers refuse to make noise until the user has clicked
   something, so we only create the audio machinery on the first
   click anywhere on the page.
   ============================================================ */

let audio = null;

function initAudio() {
  if (audio) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 2100;
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    audio = { ctx, gain };
  } catch (err) {
    audio = null;   // no sound available; everything else still works
  }
}

function updateSound(sim) {
  if (!audio) return;
  const buzzing = state.parts.some(p => p.type === 'buzzer' && sim.partState[p.id].sounding);
  const target = (state.soundOn && buzzing) ? 0.05 : 0;
  audio.gain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.02);
}


/* ============================================================
   Saving — everything lives in the browser, no server needed
   ============================================================ */

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      parts: state.parts,
      wires: state.wires,
      nextId: state.nextId,
      completed: [...state.completed],
      soundOn: state.soundOn
    }));
  } catch (err) { /* private browsing: just don't save */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.parts = (data.parts || []).filter(p => PARTS[p.type]);
    state.wires = data.wires || [];
    state.nextId = data.nextId || (state.parts.length + state.wires.length + 1);
    state.completed = new Set(data.completed || []);
    state.soundOn = data.soundOn !== false;
    // Buttons are never held down when the page loads.
    state.parts.forEach(p => { p.state.pressed = false; });
  } catch (err) { /* corrupt save: start fresh */ }
}

function resetProgress() {
  state.completed.clear();
  state.memory = freshMemory();
  save();
}


/* ============================================================
   Wiring up the buttons and starting the app
   ============================================================ */

function buildPalette() {
  for (const type of PALETTE_ORDER) {
    const spec = PARTS[type];
    const card = document.createElement('button');
    card.className = 'palette-item';
    card.innerHTML = `
      <svg class="palette-art" viewBox="0 0 ${PART_W} ${PART_H}">${spec.art}</svg>
      <span class="palette-name">${spec.name}</span>
      <span class="palette-blurb">${spec.blurb}</span>`;
    card.addEventListener('click', () => addPart(type));
    el.palette.appendChild(card);
  }
}

function init() {
  buildPalette();
  buildChallengeList();
  load();
  rebuildBench();

  document.getElementById('clearBtn').addEventListener('click', clearBench);
  document.getElementById('resetProgressBtn').addEventListener('click', () => {
    resetProgress();
    flashStatus('Challenge progress reset.');
  });

  const soundBtn = document.getElementById('soundToggle');
  const paintSoundBtn = () => {
    soundBtn.textContent = state.soundOn ? '🔊 Sound' : '🔇 Muted';
    soundBtn.classList.toggle('muted', !state.soundOn);
  };
  soundBtn.addEventListener('click', () => { state.soundOn = !state.soundOn; paintSoundBtn(); save(); });
  paintSoundBtn();

  const modal = document.getElementById('helpModal');
  document.getElementById('helpBtn').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('helpClose').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  // Pressing Escape cancels a half-drawn wire or closes the pop-up.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    modal.classList.add('hidden');
    state.armedLeg = null;
    refreshLegHighlights();
  });

  document.addEventListener('pointerdown', initAudio, { once: true });

  // Clicking bare bench cancels a half-drawn wire.
  el.bench.addEventListener('pointerdown', e => {
    if (e.target === el.bench || e.target === el.partsLayer || e.target === el.wireLayer) {
      state.armedLeg = null;
      refreshLegHighlights();
    }
  });

  // Keep wires attached if the window is resized.
  window.addEventListener('resize', () => drawWires());

  // Show the guide the very first time someone visits.
  if (!localStorage.getItem(SAVE_KEY)) modal.classList.remove('hidden');

  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', init);
