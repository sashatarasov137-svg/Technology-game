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

/* Is this a finger or a mouse? A fingertip is imprecise and wobbles,
   so it needs a much larger movement before we call it a drag —
   otherwise a simple tap gets mistaken for one and a switch never
   toggles. */
const COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;
const DRAG_THRESHOLD = COARSE_POINTER ? 12 : 5;


/* ============================================================
   Adding, moving and removing parts
   ============================================================ */

function addPart(type) {
  const spec = PARTS[type];

  // A battery and a solar panel fighting each other is a lesson for
  // another day — one power source at a time.
  if (spec.source && state.parts.some(p => PARTS[p.type].source)) {
    const existing = state.parts.find(p => PARTS[p.type].source);
    flashStatus(existing.type === type
      ? 'You only need one ' + spec.name.toLowerCase() + '.'
      : 'Remove the ' + PARTS[existing.type].name.toLowerCase() + ' first — one power source at a time.');
    return;
  }

  const startValue = spec.capacitor ? spec.capacitance : spec.resistance;
  const part = {
    id: 'p' + (state.nextId++),
    type,
    ...findFreeSpot(),
    state: {
      closed: !!spec.startsClosed,
      pressed: false,
      resistance: spec.resistance,
      capacitance: spec.capacitance || 0,
      charge: 0,
      sun: 100,
      arm: spec.arm || 6,
      valueIndex: spec.values ? Math.max(0, spec.values.indexOf(startValue)) : 0
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
    const y = 78 + Math.floor(i / cols) * gapY;   // clear of the connect prompt
    const taken = state.parts.some(p => Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 20);
    if (!taken) return { x, y };
  }
  return { x: 30, y: 78 };
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

function kindOfNode(ref) {
  const part = state.parts.find(p => p.id === ref.partId);
  if (!part) return null;
  const node = nodeOf(part.type, ref.legId);
  return node ? node.kind : null;
}

function onNodeClick(partId, legId) {
  const here = { partId, legId };

  if (!state.armedLeg) {
    state.armedLeg = here;
  } else if (state.armedLeg.partId === partId && state.armedLeg.legId === legId) {
    state.armedLeg = null;                       // tapped the same point: cancel
  } else {
    const from = state.armedLeg;

    // You cannot solder a wire onto a spinning shaft.
    const fromKind = kindOfNode(from), toKind = kindOfNode(here);
    if (fromKind !== toKind) {
      flashStatus(fromKind === 'shaft'
        ? 'A drive shaft only links to another shaft (the square points).'
        : 'A wire only joins legs (the round points), not a drive shaft.');
      state.armedLeg = null;
      refreshLegHighlights();
      return;
    }

    const exists = state.wires.some(w => sameLeg(w.from, from) && sameLeg(w.to, here)
                                      || sameLeg(w.from, here) && sameLeg(w.to, from));
    if (!exists) {
      state.wires.push({
        id: 'w' + (state.nextId++),
        kind: fromKind === 'shaft' ? 'drive' : 'wire',
        from, to: here
      });
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

  /* Connection points. Round ones carry electricity, square ones
     carry turning — and the two never join to each other. */
  for (const point of nodesOf(part.type)) {
    const dot = document.createElement('button');
    dot.className = (point.kind === 'shaft' ? 'shaft-dot' : 'leg-dot')
                  + (point.label ? ' leg-' + (point.polarity || point.role || '') : '');
    dot.style.left = point.x + 'px';
    dot.style.top  = point.y + 'px';
    dot.dataset.leg = point.id;
    dot.dataset.kind = point.kind;
    dot.title = point.kind === 'shaft' ? 'Drive shaft'
              : point.label ? 'Leg ' + point.label : 'Leg';
    if (point.label) dot.innerHTML = `<span class="leg-label">${point.label}</span>`;
    dot.addEventListener('pointerdown', e => e.stopPropagation());
    dot.addEventListener('click', e => { e.stopPropagation(); onNodeClick(part.id, point.id); });
    node.appendChild(dot);
  }

  // A readable value badge on the parts that have one.
  if (spec.values || spec.slider) {
    const badge = document.createElement('div');
    badge.className = 'part-value';
    node.appendChild(badge);
  }

  // Some parts have something to slide: the dial's resistance, the
  // sun on the solar panel, the arm length of the lever.
  if (spec.slider) {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'pot-slider';
    slider.min = spec.slider.min; slider.max = spec.slider.max; slider.step = spec.slider.step;
    slider.value = part.state[spec.slider.prop];
    slider.addEventListener('pointerdown', e => e.stopPropagation());
    slider.addEventListener('input', () => {
      part.state[spec.slider.prop] = Number(slider.value);
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
  let dragging = false, moved = false, offX = 0, offY = 0, tapAt = null;

  node.addEventListener('pointerdown', e => {
    const rect = el.bench.getBoundingClientRect();
    offX = e.clientX - rect.left - part.x;
    offY = e.clientY - rect.top  - part.y;
    tapAt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging = true; moved = false;
    node.classList.add('grabbing');
    if (spec.momentary) part.state.pressed = true;      // hold-to-close

    // Keep receiving events even if the finger slides off the part.
    // Wrapped because some browsers refuse the capture, and if that
    // threw here it would abort the press above.
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
  });

  node.addEventListener('pointermove', e => {
    if (!dragging) return;
    const rect = el.bench.getBoundingClientRect();
    const nx = e.clientX - rect.left - offX;
    const ny = e.clientY - rect.top  - offY;
    if (!moved && Math.abs(nx - part.x) + Math.abs(ny - part.y) < DRAG_THRESHOLD) return;
    moved = true;
    if (spec.momentary) part.state.pressed = false;     // a drag is not a press
    // Leave a margin so the delete button never falls off the bench.
    part.x = clamp(nx, 16, el.bench.clientWidth  - PART_W - 16);
    part.y = clamp(ny, 16, el.bench.clientHeight - PART_H - 24);
    node.style.left = part.x + 'px';
    node.style.top  = part.y + 'px';
    drawWires();
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    node.classList.remove('grabbing');
    if (spec.momentary) part.state.pressed = false;
    if (!moved) onPartClick(part, spec, tapAt);
    save();
  };
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
}

/* Which of this part's connection points is closest to where the
   finger landed? Only points of the right kind count — tapping a
   gear while holding a wire should not find its shaft. */
function nearestNode(part, point, kind) {
  const candidates = nodesOf(part.type).filter(n => n.kind === kind);
  if (!candidates.length) return null;
  let best = candidates[0], bestDist = Infinity;
  for (const node of candidates) {
    const d = Math.hypot(part.x + node.x - point.x, part.y + node.y - point.y);
    if (d < bestDist) { bestDist = d; best = node; }
  }
  return best;
}

function onPartClick(part, spec, tapAt) {
  /* Half-drawn wire? Then this tap means "join to that part", and we
     work out which leg was meant rather than making the user hit a
     small circle exactly. */
  if (state.armedLeg) {
    if (state.armedLeg.partId === part.id) {
      state.armedLeg = null;              // tapping the start again cancels
      refreshLegHighlights();
      return;
    }
    const want = kindOfNode(state.armedLeg);
    const target = nearestNode(part, tapAt || { x: part.x, y: part.y }, want);
    if (!target) {
      flashStatus(want === 'shaft'
        ? PARTS[part.type].name + ' has no drive shaft to link to.'
        : PARTS[part.type].name + ' has no legs to wire to.');
      state.armedLeg = null;
      refreshLegHighlights();
      return;
    }
    onNodeClick(part.id, target.id);
    return;
  }

  if (spec.toggle) {
    part.state.closed = !part.state.closed;
  } else if (spec.values) {
    part.state.valueIndex = (part.state.valueIndex + 1) % spec.values.length;
    const value = spec.values[part.state.valueIndex];
    if (spec.capacitor) {
      part.state.capacitance = value;
      flashStatus('Capacitor set to ' + value + ' µF — bigger stores more.');
    } else {
      part.state.resistance = value;
      flashStatus('Resistor set to ' + formatOhms(value) + '.');
    }
  } else {
    flashStatus(spec.name + ': ' + spec.blurb);
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


/* --- wires ------------------------------------------------ */

function legPosition(partId, legId) {
  const part = state.parts.find(p => p.id === partId);
  if (!part) return null;
  const node = nodeOf(part.type, legId);
  if (!node) return null;
  return { x: part.x + node.x, y: part.y + node.y };
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

    const drive = wire.kind === 'drive';
    els.line.classList.toggle('wire-drive', drive);
    if (drive) {
      // A drive link glows while it is actually transmitting turning.
      const turning = state.lastSim
        && (state.lastSim.partState[wire.from.partId] || {}).rpm > 0
        && (state.lastSim.partState[wire.to.partId]   || {}).driven;
      els.line.classList.toggle('wire-turning', !!turning);
    } else {
      const live = !!liveParts && liveParts.has(wire.from.partId) && liveParts.has(wire.to.partId);
      els.line.classList.toggle('wire-live', live);
    }
  }
}

function refreshLegHighlights() {
  document.querySelectorAll('.leg-dot').forEach(dot => dot.classList.remove('armed'));

  const pill = document.getElementById('connectPill');
  pill.classList.toggle('hidden', !state.armedLeg);

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

let lastFrame = performance.now();

function tick() {
  // Capacitors fill and empty over time, so the simulation needs to
  // know how long the last frame took. Capped so that switching back
  // to the tab does not dump a huge jump into it.
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  const sim = simulate(state.parts, state.wires, dt);
  simulateMechanics(state.parts, state.wires, sim);
  state.lastSim = sim;
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
    if (part.type === 'bulb') {
      node.style.setProperty('--glow', st.brightness.toFixed(3));
      node.classList.toggle('lit', st.brightness > 0.05);
    }
    if (part.type === 'buzzer') {
      node.classList.toggle('sounding', st.sounding);
    }
    if (part.type === 'fan') {
      node.classList.toggle('spinning', st.blowing > 0);
      node.style.setProperty('--spin', (0.9 - st.blowing * 0.78).toFixed(2) + 's');
    }
    if (part.type === 'solar') {
      node.style.setProperty('--sun', (part.state.sun / 100).toFixed(2));
    }
    if (PARTS[part.type].capacitor) {
      node.style.setProperty('--fill', (st.fill || 0).toFixed(3));
      node.classList.toggle('charged', (st.charge || 0) > 0.5);
    }

    /* Anything that turns — the motor, gears, pulleys, wheels — is
       animated at its own speed and in its own direction. One
       revolution takes 60/rpm seconds. */
    if (part.type === 'motor' || PARTS[part.type].mechanical) {
      const rpm = Math.max(st.rpm, 0);
      const turning = rpm > 0.5;
      node.classList.toggle('spinning', turning);
      node.classList.toggle('moving', turning || (st.linear || 0) > 0.05);
      if (turning) {
        node.style.setProperty('--spin', Math.max(0.12, 60 / rpm).toFixed(2) + 's');
        node.style.setProperty('--spin-dir', st.direction < 0 ? 'reverse' : 'normal');
      }
      // A rack and a lever slide and rock rather than spin round.
      if ((st.linear || 0) > 0.05) {
        node.style.setProperty('--slide', Math.max(0.25, 6 / st.linear).toFixed(2) + 's');
      }
    }

    const badge = node.querySelector('.part-value');
    if (badge) badge.textContent = valueLabel(part);
  }

  drawWires(liveParts);
}

/* The little badge on a part: whatever number matters for it. */
function valueLabel(part) {
  const spec = PARTS[part.type];
  if (spec.capacitor) return part.state.capacitance + ' µF';
  if (part.type === 'solar') return part.state.sun + '%';
  if (spec.mechanical === 'lever') return part.state.arm + ' cm';
  if (spec.mechanical === 'gear') return spec.teeth + 'T';
  if (spec.slider && spec.slider.prop === 'resistance') return formatOhms(part.state.resistance);
  if (spec.values) return formatOhms(part.state.resistance);
  return '';
}

function updateReadout(sim) {
  const rows = [];
  const supply = state.parts.find(p => PARTS[p.type].source);

  if (supply) {
    rows.push([PARTS[supply.type].name,
      supply.type === 'solar'
        ? formatVolts(PARTS.solar.voltage * supply.state.sun / 100)
        : '9 V']);
  }

  const workingLoops = sim.loops.filter(l => l.blockedBy.length === 0 && l.current > 0);
  if (workingLoops.length) {
    rows.push(['Complete loops', String(workingLoops.length)]);
    const strongest = workingLoops.reduce((a, b) => a.current > b.current ? a : b);
    rows.push(['Loop resistance', formatOhms(strongest.resistance)]);
    rows.push(['Current', formatCurrent(strongest.current)]);
  }

  for (const part of state.parts) {
    const st = sim.partState[part.id];
    if (st.current > 0 && !PARTS[part.type].source) {
      rows.push([PARTS[part.type].name, formatCurrent(st.current)]);
    }
    if (PARTS[part.type].capacitor) {
      rows.push(['Capacitor stored', formatVolts(st.charge || 0)]);
    }
  }

  /* The mechanical side gets its own block, because rpm and turning
     force are the whole point of adding gears. */
  const mech = [];
  const motor = state.parts.find(p => p.type === 'motor' && sim.partState[p.id].rpm > 0);
  if (motor) mech.push(['Motor', formatRpm(sim.partState[motor.id].rpm)
                                 + ' · ' + formatTorque(sim.partState[motor.id].torque)]);

  for (const part of state.parts) {
    const spec = PARTS[part.type];
    const st = sim.partState[part.id];
    if (!spec.mechanical || !st.driven) continue;

    if (spec.mechanical === 'rack') {
      mech.push([spec.name, formatSpeed(st.linear) + ' · ' + formatForce(st.force)]);
    } else if (spec.mechanical === 'wheel') {
      mech.push([spec.name, formatRpm(st.rpm) + ' · ' + formatSpeed(st.linear)]);
    } else if (spec.mechanical === 'lever') {
      mech.push([spec.name, formatForce(st.force) + ' at the tip']);
    } else {
      mech.push([spec.name, formatRpm(st.rpm) + ' · ' + formatTorque(st.torque)]);
    }
  }

  // The overall gearing, which is the headline number.
  const driven = state.parts.filter(p => PARTS[p.type].mechanical && sim.partState[p.id].driven);
  if (driven.length && motor) {
    const end = driven.reduce((a, b) =>
      (sim.partState[b.id].ratio || 1) > (sim.partState[a.id].ratio || 1) ? b : a);
    const ratio = sim.partState[end.id].ratio;
    if (isFinite(ratio) && ratio > 0) mech.push(['Gear ratio', formatRatio(ratio)]);
  }

  if (!rows.length && !mech.length) {
    el.readoutBody.innerHTML = '<p class="muted">Nothing connected yet.</p>';
    return;
  }

  const render = list => list
    .map(([k, v]) => `<div class="readout-row"><span>${k}</span><strong>${v}</strong></div>`)
    .join('');

  el.readoutBody.innerHTML = render(rows)
    + (mech.length ? '<h4 class="readout-sub">Mechanical</h4>' + render(mech) : '');
}

let flashUntil = 0, flashMessage = '';

function flashStatus(text) {
  flashMessage = text;
  flashUntil = Date.now() + 2400;
}

function updateStatus(sim) {
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
    state.wires = (data.wires || []).map(w => ({ ...w, kind: w.kind || 'wire' }));

    // Fill in anything a save from an older version will not have.
    for (const part of state.parts) {
      const spec = PARTS[part.type];
      part.state.charge      ??= 0;
      part.state.sun         ??= 100;
      part.state.arm         ??= spec.arm || 6;
      part.state.capacitance ??= spec.capacitance || 0;
    }
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
  // Twenty parts in one list is a wall. Grouping them keeps it findable.
  for (const group of PALETTE_GROUPS) {
    const heading = document.createElement('h3');
    heading.className = 'palette-group';
    heading.textContent = group.title;
    el.palette.appendChild(heading);

    for (const type of group.types) {
      const spec = PARTS[type];
      const card = document.createElement('button');
      card.className = 'palette-item';
      card.innerHTML = `
        <svg class="palette-art" viewBox="0 0 ${PART_W} ${PART_H}">${spec.art}</svg>
        <span class="palette-name">${spec.name}</span>
        <span class="palette-blurb">${spec.blurb}</span>`;
      card.addEventListener('click', () => {
        addPart(type);
        // Get out of the way so the new part is visible straight away.
        if (sheetMode()) closeSheets();
      });
      el.palette.appendChild(card);
    }
  }
}

/* ---- the sliding panels used on touch screens ---- */

function sheetMode() {
  return window.matchMedia('(pointer: coarse), (max-width: 900px)').matches;
}

function openSheet(which) {
  closeSheets();
  const panel = document.querySelector(which === 'parts' ? '.panel-parts' : '.panel-challenges');
  panel.classList.add('open');
  document.getElementById('sheetBackdrop').classList.remove('hidden');
}

function closeSheets() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  document.getElementById('sheetBackdrop').classList.add('hidden');
}

function init() {
  const verb = COARSE_POINTER ? 'Tap' : 'Click';
  document.querySelector('.connect-pill-text').textContent = `🔗 ${verb} another leg to connect`;
  document.querySelector('.panel-hint').textContent = `${verb} a part to drop it on the bench.`;

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
    soundBtn.firstChild.textContent = state.soundOn ? '🔊 ' : '🔇 ';
    soundBtn.querySelector('.btn-word').textContent = state.soundOn ? 'Sound' : 'Muted';
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
    closeSheets();
    state.armedLeg = null;
    refreshLegHighlights();
  });

  document.getElementById('partsBtn').addEventListener('click', () => openSheet('parts'));
  document.getElementById('challengesBtn').addEventListener('click', () => openSheet('challenges'));
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheets);
  document.querySelectorAll('.sheet-close').forEach(b => b.addEventListener('click', closeSheets));

  document.getElementById('connectCancel').addEventListener('click', e => {
    e.stopPropagation();
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

  // Keep wires attached when a sheet opens or the orientation changes.
  window.addEventListener('orientationchange', () => setTimeout(() => drawWires(), 250));

  requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', init);
