/* ============================================================
   mechanics.js — the mechanical simulation
   ------------------------------------------------------------
   Electricity flows in loops. Turning does not — it spreads out
   from whatever is driving it, like a family tree. So this is a
   different kind of search from the one in circuit.js: start at
   the motor and walk outwards through the drive links, working
   out what each part does as we reach it.

   The one rule worth remembering is that you never get something
   for nothing. Whenever a link slows things down, it multiplies
   the turning force by exactly the same amount, and whenever it
   speeds things up it divides the force. Gearing is a trade, not
   a gain.
   ============================================================ */

/* Turning force is measured in newton-centimetres (N·cm): a push
   of one newton applied one centimetre from the centre. Divide it
   by a radius and you get back a plain force in newtons. */

/* How big is this part, in centimetres, where it meets another? */
function pitchRadius(part) {
  const spec = PARTS[part.type];
  if (spec.mechanical === 'gear')   return spec.teeth * 0.1;
  if (spec.mechanical === 'pulley') return spec.radius / 10;
  if (spec.mechanical === 'wheel')  return spec.wheelRadius;
  if (spec.mechanical === 'buggy')  return spec.wheelRadius;
  if (spec.mechanical === 'lever')  return part.state.arm || spec.arm;
  return 1;
}

/* Revolutions per minute into radians per second, so we can turn
   a rotation into a speed along the ground. */
const angularSpeed = rpm => (rpm / 60) * Math.PI * 2;


/* ------------------------------------------------------------
   What happens where two parts meet?

     mesh   two gears, teeth to teeth. The bigger one turns
            slower and the other way round.
     belt   two pulleys with a belt between them. Same idea, but
            sized by radius, and both turn the same way.
     shaft  anything else — treated as mounted on one axle, so it
            simply passes the turning straight through.
   ------------------------------------------------------------ */
function couplingBetween(from, to) {
  const a = PARTS[from.type].mechanical;
  const b = PARTS[to.type].mechanical;

  if (a === 'gear' && b === 'gear') {
    return { kind: 'mesh', ratio: PARTS[to.type].teeth / PARTS[from.type].teeth, flip: true };
  }
  if (a === 'pulley' && b === 'pulley') {
    return { kind: 'belt', ratio: PARTS[to.type].radius / PARTS[from.type].radius, flip: false };
  }
  return { kind: 'shaft', ratio: 1, flip: false };
}


/* ------------------------------------------------------------
   Run the mechanical side. It reads the rpm and torque the motor
   produced in circuit.js, then fills in every part the motor can
   reach through drive links.
   ------------------------------------------------------------ */
function simulateMechanics(parts, links, result) {
  const st = result.partState;
  const byId = new Map(parts.map(p => [p.id, p]));

  // Who is linked to whom?
  const neighbours = {};
  for (const link of links) {
    if (link.kind !== 'drive') continue;
    (neighbours[link.from.partId] ||= []).push(link.to.partId);
    (neighbours[link.to.partId]   ||= []).push(link.from.partId);
  }

  // Motors are where movement comes from.
  const queue = [];
  const reached = new Set();
  for (const part of parts) {
    if (part.type === 'motor' && st[part.id].rpm > 0) {
      st[part.id].driven = true;
      st[part.id].ratio = 1;
      st[part.id].sourceRpm = st[part.id].rpm;
      reached.add(part.id);
      queue.push(part.id);
    }
  }

  // Walk outwards, one link at a time.
  while (queue.length) {
    const fromId = queue.shift();
    const from = byId.get(fromId);

    for (const toId of (neighbours[fromId] || [])) {
      if (reached.has(toId)) continue;
      const to = byId.get(toId);
      if (!to) continue;

      reached.add(toId);
      transmit(from, to, st);
      queue.push(toId);
    }
  }

  // Anything mechanical the motor never reached is just sitting there.
  for (const part of parts) {
    const spec = PARTS[part.type];
    if (spec.mechanical && !reached.has(part.id)) {
      st[part.id].driven = false;
      st[part.id].rpm = 0;
      st[part.id].torque = 0;
    }
  }

  addMechanicalMessages(parts, result, reached);
}


/* Pass the turning from one part to the next. */
function transmit(from, to, st) {
  const a = st[from.id], b = st[to.id];
  const { kind, ratio, flip } = couplingBetween(from, to);

  b.driven    = true;
  b.linkKind  = kind;
  b.stepRatio = ratio;
  b.rpm       = a.rpm / ratio;              // slower by the ratio...
  b.torque    = a.torque * ratio;           // ...and stronger by the same
  b.direction = flip ? -a.direction : a.direction;
  b.sourceRpm = a.sourceRpm;
  b.ratio     = a.sourceRpm > 0 ? a.sourceRpm / b.rpm : 1;   // overall, from the motor

  const spec = PARTS[to.type];

  /* A rack does not spin at all — the gear driving it walks it
     along. How fast depends on the size of that gear. */
  if (spec.mechanical === 'rack') {
    const r = pitchRadius(from);
    b.linear = angularSpeed(a.rpm) * r;
    b.force  = a.torque / Math.max(r, 0.01);
    b.rpm = 0;
    b.direction = a.direction;
  }

  /* A wheel turns with the shaft, and its rim travels along the
     ground at a speed set by how big it is. */
  if (spec.mechanical === 'wheel') {
    const r = pitchRadius(to);
    b.linear = angularSpeed(b.rpm) * r;
    b.force  = b.torque / Math.max(r, 0.01);
  }

  /* The buggy is where gearing stops being a number. Its wheels can
     only push as hard as the turning force allows, and if that is
     less than the ground demands it simply does not move. A slope
     demands a great deal more than the flat. */
  if (spec.mechanical === 'buggy') {
    const r = pitchRadius(to);
    const push   = b.torque / Math.max(r, 0.01);        // newtons at the wheels
    const needed = to.state.hill ? spec.hillForce : spec.rollingForce;

    b.push   = push;
    b.needed = needed;
    b.onHill = !!to.state.hill;
    b.stalled = push < needed;
    b.linear = b.stalled ? 0 : angularSpeed(b.rpm) * r;
    if (b.stalled) b.rpm = 0;
  }

  /* A lever trades distance for force: the further out you push,
     the less force you get but the further the end travels. */
  if (spec.mechanical === 'lever') {
    const arm = pitchRadius(to);
    b.force  = b.torque / Math.max(arm, 0.01);
    b.linear = angularSpeed(b.rpm) * arm;
  }
}


function addMechanicalMessages(parts, result, reached) {
  const mechanical = parts.filter(p => PARTS[p.type].mechanical);
  if (!mechanical.length) return;

  const motor = parts.find(p => p.type === 'motor');
  const driven = mechanical.filter(p => reached.has(p.id));

  if (!motor) {
    result.issues.push({ level: 'info', text: 'Add a motor and link its shaft (□) to a gear to make things turn.' });
    return;
  }
  if (!driven.length) {
    if (result.partState[motor.id].rpm > 0) {
      result.issues.push({ level: 'info', text: 'The motor is running. Link its shaft (□) to a gear\'s hub to drive it.' });
    }
    return;
  }

  /* Report the end of the chain. This is the only place the
     mechanical numbers appear, so it carries the real figures
     rather than just saying that something is turning. */
  const end = driven.reduce((a, b) =>
    (result.partState[b.id].ratio || 1) > (result.partState[a.id].ratio || 1) ? b : a);

  const st = result.partState[end.id];
  const spec = PARTS[end.type];
  const ratio = st.ratio;
  const motorSt = result.partState[motor.id];

  /* A buggy on the bench is the headline: is it moving or stuck? */
  const buggy = driven.find(p => PARTS[p.type].mechanical === 'buggy');
  if (buggy) {
    const bst = result.partState[buggy.id];
    const where = bst.onHill ? 'up the hill' : 'on the flat';
    if (bst.stalled) {
      result.issues.push({
        level: 'warn', mech: true,
        text: `Buggy stalled ${where} — the wheels can only push ${formatForce(bst.push)} and it needs ${formatForce(bst.needed)}. Gear down for more force.`
      });
    } else {
      result.issues.push({
        level: 'good', mech: true,
        text: `Buggy driving ${where} at ${formatSpeed(bst.linear)}, pushing ${formatForce(bst.push)} (needs ${formatForce(bst.needed)}). Gear ratio ${formatRatio(bst.ratio)}.`
      });
    }
    return;
  }

  let detail;
  if (spec.mechanical === 'rack')       detail = `${spec.name} ${formatSpeed(st.linear)} · ${formatForce(st.force)}`;
  else if (spec.mechanical === 'wheel') detail = `${spec.name} ${formatRpm(st.rpm)} · ${formatSpeed(st.linear)}`;
  else if (spec.mechanical === 'lever') detail = `${spec.name} ${formatForce(st.force)} at the tip`;
  else                                  detail = `${spec.name} ${formatRpm(st.rpm)} · ${formatTorque(st.torque)}`;

  let head;
  if (ratio > 1.05)                   head = `Geared down ${formatRatio(ratio)}`;
  else if (ratio < 0.95 && ratio > 0) head = `Geared up ${formatRatio(ratio)}`;
  else                                head = 'Driving straight through';

  result.issues.push({
    level: 'good',
    mech: true,
    text: `${head} — ${detail}. Motor ${formatRpm(motorSt.rpm)} · ${formatTorque(motorSt.torque)}.`
  });
}
