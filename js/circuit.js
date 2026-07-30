/* ============================================================
   circuit.js — the electrical simulation
   ------------------------------------------------------------
   This is the brain. It is handed a list of parts and a list of
   wires, and it works out what the electricity does.

   The whole thing rests on one idea: electricity only flows in a
   complete loop. It has to leave the power source's + side,
   travel through parts, and arrive back at the − side. If the
   loop is broken anywhere, nothing happens.

   So the job breaks into three steps:
     1. Work out which legs are joined together by wires.
     2. Find every complete loop from + back to −.
     3. For each loop, work out how much current flows.
   ============================================================ */

/* Some physical constants for our little world. */
const IDEAL_LED_CURRENT  = 0.020;   // 20 mA — a happy, bright LED
const LED_BURN_CURRENT   = 0.045;   // 45 mA — in real life it dies
const IDEAL_BULB_CURRENT = 0.045;
const MOTOR_MIN_CURRENT  = 0.012;   // below this a motor won't turn
const FAN_MIN_CURRENT    = 0.010;
const BUZZER_MIN_CURRENT = 0.004;
const SHORT_RESISTANCE   = 3;       // a loop with less than this is a short circuit
const MIN_RESISTANCE     = 0.4;     // stops us dividing by zero
const CAP_MIN_VOLTS      = 0.08;    // below this a capacitor counts as empty


/* ------------------------------------------------------------
   Step 1: which legs are joined?

   If leg A is wired to leg B, and leg B is wired to leg C, then
   all three are electrically the same point. Electricians call
   such a group a "net". We find the groups with a classic little
   algorithm called union-find: everyone starts in their own
   group, and every wire merges two groups into one.
   ------------------------------------------------------------ */
function buildNets(parts, wires) {
  const parent = {};
  const legKey = (partId, legId) => partId + ':' + legId;

  function add(key) { if (!(key in parent)) parent[key] = key; }

  function find(key) {
    while (parent[key] !== key) {
      parent[key] = parent[parent[key]];   // flatten as we go, for speed
      key = parent[key];
    }
    return key;
  }

  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (const part of parts) {
    for (const leg of (PARTS[part.type].legs || [])) add(legKey(part.id, leg.id));
  }

  // Only wires join legs. Drive links between shafts are mechanical
  // and have nothing to do with electricity.
  for (const wire of wires) {
    if (wire.kind === 'drive') continue;
    const a = legKey(wire.from.partId, wire.from.legId);
    const b = legKey(wire.to.partId, wire.to.legId);
    if (a in parent && b in parent) union(a, b);
  }

  return { netOf: (partId, legId) => find(legKey(partId, legId)) };
}


/* How much does one part resist electricity right now?
   Infinity means "completely blocked" — an open switch is
   literally a gap in the circuit, so nothing can get through. */
function resistanceOf(part) {
  const spec = PARTS[part.type];
  if (spec.toggle)    return part.state.closed  ? 0 : Infinity;
  if (spec.momentary) return part.state.pressed ? 0 : Infinity;
  if (spec.slider && spec.slider.prop === 'resistance') return part.state.resistance;
  if (spec.values && !spec.capacitor) return part.state.resistance;
  return spec.resistance;
}

/* What voltage can this part push out right now? */
function voltageOf(part) {
  const spec = PARTS[part.type];
  if (part.type === 'solar') return spec.voltage * (part.state.sun / 100);
  if (spec.capacitor)        return part.state.charge || 0;
  return spec.voltage || 0;
}


/* ------------------------------------------------------------
   Step 2: find every complete loop.

   We treat the circuit as a map: nets are places, parts are the
   roads between them. Starting at the source's + net we walk
   every possible route until we arrive at the − net, never using
   the same road or visiting the same place twice.
   ------------------------------------------------------------ */
function findLoops(startNet, endNet, edges) {
  const byNet = {};
  edges.forEach((edge, i) => {
    (byNet[edge.a] ||= []).push(i);
    (byNet[edge.b] ||= []).push(i);
  });

  const loops = [];
  const usedEdges = new Set();
  const visitedNets = new Set([startNet]);
  const trail = [];

  function walk(net) {
    if (loops.length >= 200 || trail.length > 12) return;   // safety limits

    for (const i of (byNet[net] || [])) {
      if (usedEdges.has(i)) continue;
      const edge = edges[i];
      if (edge.a === edge.b) continue;                       // part wired to itself
      const nextNet = (edge.a === net) ? edge.b : edge.a;

      // Note which way round we crossed this part — LEDs care.
      const step = { edge, backwards: (net !== edge.a) };

      if (nextNet === endNet) {
        loops.push([...trail, step]);                        // arrived home
      } else if (!visitedNets.has(nextNet)) {
        usedEdges.add(i); visitedNets.add(nextNet); trail.push(step);
        walk(nextNet);
        usedEdges.delete(i); visitedNets.delete(nextNet); trail.pop();
      }
    }
  }

  walk(startNet);
  return loops;
}


/* Build the "roads": one per electrical part, joining the nets
   its two legs sit in. The part acting as the source is left out,
   because it is the thing pushing rather than a thing in the way. */
function buildEdges(parts, nets, sourcePart) {
  const edges = [];
  for (const part of parts) {
    const spec = PARTS[part.type];
    if (!spec.legs || spec.legs.length < 2) continue;
    if (part === sourcePart) continue;

    const legA = spec.legs.find(l => l.role === 'anode')   || spec.legs[0];
    const legB = spec.legs.find(l => l.role === 'cathode') || spec.legs[1];
    edges.push({
      partId: part.id,
      part,
      type: part.type,
      a: nets.netOf(part.id, legA.id),      // for an LED, 'a' is always the + leg
      b: nets.netOf(part.id, legB.id),
      resistance: resistanceOf(part),
      polarised: !!spec.polarised && !spec.capacitor,
      capacitor: !!spec.capacitor
    });
  }
  return edges;
}


/* Work out the current in every loop from one source.
   Ohm's law: current = voltage ÷ resistance. */
function solveFrom(sourcePart, voltage, parts, nets, result) {
  const spec = PARTS[sourcePart.type];
  const posLeg = spec.legs.find(l => l.polarity === 'pos' || l.role === 'anode');
  const negLeg = spec.legs.find(l => l.polarity === 'neg' || l.role === 'cathode');
  const posNet = nets.netOf(sourcePart.id, posLeg.id);
  const negNet = nets.netOf(sourcePart.id, negLeg.id);

  if (posNet === negNet) {
    result.issues.push({ level: 'danger', text: 'Short circuit! The + and − are joined with nothing in between. In real life the battery would get hot.' });
    return { loops: [], powered: false };
  }

  const edges = buildEdges(parts, nets, sourcePart);
  const rawLoops = findLoops(posNet, negNet, edges);
  const loops = [];
  let powered = false;

  for (const steps of rawLoops) {
    const loop = { partIds: steps.map(s => s.edge.partId), resistance: 0, current: 0, blockedBy: [], caps: [] };

    // A charged capacitor pushes back against the source, which is
    // exactly why the current tails off as it fills up.
    let emf = voltage;

    for (const step of steps) {
      const { edge, backwards } = step;
      result.partState[edge.partId].inLoop = true;

      if (edge.polarised && backwards) {
        loop.blockedBy.push({ partId: edge.partId, reason: 'reversed' });
        result.partState[edge.partId].reversed = true;
        continue;
      }
      if (edge.resistance === Infinity) {
        loop.blockedBy.push({ partId: edge.partId, reason: 'open' });
        continue;
      }
      loop.resistance += edge.resistance;

      if (edge.capacitor) {
        const v = edge.part.state.charge || 0;
        emf += backwards ? v : -v;
        loop.caps.push({ part: edge.part, charging: !backwards });
      }
    }

    if (loop.blockedBy.length === 0 && emf > 0) {
      loop.current = emf / Math.max(loop.resistance, MIN_RESISTANCE);
      powered = true;
      for (const id of loop.partIds) {
        result.partState[id].current = Math.max(result.partState[id].current, loop.current);
      }
      if (loop.resistance < SHORT_RESISTANCE && !loop.caps.length) loop.shorted = true;
    }

    loops.push(loop);
  }

  return { loops, powered, posNet, negNet };
}


/* ------------------------------------------------------------
   The main entry point. `dt` is how many seconds have passed
   since the last frame — capacitors need it, because they fill
   up and drain over time rather than instantly.
   ------------------------------------------------------------ */
function simulate(parts, wires, dt = 0) {
  const result = {
    hasSource: false,
    partState: {},        // partId -> { current, brightness, spinning, ... }
    loops: [],
    issues: [],
    powered: false,
    runningOnCapacitor: false
  };

  for (const part of parts) {
    result.partState[part.id] = {
      current: 0, brightness: 0, spinning: 0, sounding: false, blowing: 0,
      reversed: false, overloaded: false, inLoop: false,
      rpm: 0, torque: 0, direction: 0, linear: 0, force: 0, ratio: 1, driven: false
    };
  }

  const nets = buildNets(parts, wires);
  const supply = parts.find(p => PARTS[p.type].source);

  if (!supply) {
    result.issues.push({ level: 'info', text: 'Add a battery or a solar panel — nothing works without a power source.' });
  } else {
    result.hasSource = true;
  }

  /* Try the real power source first. If it cannot drive anything —
     say the switch is open — fall back to any charged capacitor,
     which is what keeps a light glowing for a moment afterwards. */
  const candidates = [];
  if (supply && voltageOf(supply) > 0.05) candidates.push(supply);
  for (const part of parts) {
    if (PARTS[part.type].capacitor && (part.state.charge || 0) > CAP_MIN_VOLTS) candidates.push(part);
  }

  let solved = null;
  for (const candidate of candidates) {
    const attempt = solveFrom(candidate, voltageOf(candidate), parts, nets, result);
    if (attempt.powered) {
      solved = attempt;
      result.runningOnCapacitor = !!PARTS[candidate.type].capacitor;
      if (result.runningOnCapacitor) {
        // The capacitor is doing the pushing now, so it is emptying.
        for (const loop of attempt.loops) {
          if (loop.blockedBy.length || !loop.current) continue;
          drain(candidate, -loop.current, dt);
        }
      }
      break;
    }
    if (!solved) solved = attempt;      // remember the first attempt for its messages
  }

  if (solved) {
    result.loops = solved.loops;
    result.powered = solved.powered;

    // Capacitors sitting inside a powered loop fill up or empty.
    if (!result.runningOnCapacitor) {
      for (const loop of solved.loops) {
        if (loop.blockedBy.length || !loop.current) continue;
        for (const c of loop.caps) drain(c.part, c.charging ? loop.current : -loop.current, dt);
      }
    }
  }

  if (supply && voltageOf(supply) <= 0.05) {
    result.issues.push({ level: 'warn', text: 'The solar panel is in the dark. Slide the sun up to give it some light.' });
  }
  if (result.hasSource && !result.loops.length) {
    result.issues.push({ level: 'info', text: 'No complete loop yet. Current must leave the +, pass through your parts, and return to the −.' });
  }

  applyEffects(parts, result);
  describe(parts, result);
  return result;
}

/* Move charge into or out of a capacitor. Current is in amps,
   capacitance in microfarads, so the change in volts over `dt`
   seconds is current × dt ÷ capacitance. */
function drain(part, amps, dt) {
  const farads = (part.state.capacitance || PARTS[part.type].capacitance) / 1e6;
  const next = (part.state.charge || 0) + (amps * dt) / farads;
  part.state.charge = Math.max(0, Math.min(next, 9));
}


/* Turn raw current into things you can see and hear. */
function applyEffects(parts, result) {
  for (const part of parts) {
    const st = result.partState[part.id];
    const spec = PARTS[part.type];
    const amps = st.current;

    if (part.type === 'led') {
      st.brightness = Math.min(1, amps / IDEAL_LED_CURRENT);
      st.overloaded = amps > LED_BURN_CURRENT;
    }
    if (part.type === 'bulb') {
      st.brightness = Math.min(1, amps / IDEAL_BULB_CURRENT);
    }
    if (part.type === 'motor') {
      const drive = amps > MOTOR_MIN_CURRENT ? Math.min(1, amps / 0.09) : 0;
      st.spinning = drive;
      st.rpm      = drive * spec.maxRpm;
      st.torque   = drive * spec.maxTorque;
      st.direction = drive > 0 ? 1 : 0;
    }
    if (part.type === 'fan') {
      st.blowing = amps > FAN_MIN_CURRENT ? Math.min(1, amps / 0.07) : 0;
    }
    if (part.type === 'buzzer') {
      st.sounding = amps > BUZZER_MIN_CURRENT;
      st.volume = Math.min(1, amps / 0.06);
    }
    if (spec.capacitor) {
      st.charge = part.state.charge || 0;
      st.fill = st.charge / 9;
    }
  }
}


/* Decide what to tell the user, worst problem first. */
function describe(parts, result) {
  const shorted  = result.loops.some(l => l.shorted);
  const burning  = parts.filter(p => result.partState[p.id].overloaded);
  const reversed = parts.filter(p => result.partState[p.id].reversed);
  const openOnly = result.loops.length && !result.powered
                   && result.loops.every(l => l.blockedBy.length > 0);

  if (shorted) {
    result.issues.push({ level: 'danger', text: 'Short circuit! There is a loop with nothing to slow the current down. Put a resistor in it.' });
  }
  if (burning.length) {
    result.issues.push({ level: 'danger', text: 'Too much current through the LED — in real life it would burn out. Add a resistor in the loop with it.' });
  }
  if (reversed.length && !result.powered) {
    result.issues.push({ level: 'warn', text: 'That part is the wrong way round. Its + leg has to face the + side of the power source.' });
  }
  if (openOnly && !reversed.length) {
    const opener = result.loops.flatMap(l => l.blockedBy).find(b => b.reason === 'open');
    const openPart = opener && parts.find(p => p.id === opener.partId);
    if (openPart && openPart.type === 'button') {
      result.issues.push({ level: 'info', text: 'Loop complete — now hold the push button down to close it.' });
    } else if (openPart) {
      result.issues.push({ level: 'info', text: 'Loop complete, but the switch is open. Tap it to close the gap.' });
    }
  }
  if (result.powered && !shorted && !burning.length) {
    const bits = [];
    const lit = parts.filter(p => (p.type === 'led' || p.type === 'bulb')
                                  && result.partState[p.id].brightness > 0.05).length;
    if (lit) bits.push(lit === 1 ? '1 light on' : lit + ' lights on');
    if (parts.some(p => p.type === 'motor'  && result.partState[p.id].spinning)) bits.push('motor running');
    if (parts.some(p => p.type === 'fan'    && result.partState[p.id].blowing))  bits.push('fan blowing');
    if (parts.some(p => p.type === 'buzzer' && result.partState[p.id].sounding)) bits.push('buzzer sounding');

    const prefix = result.runningOnCapacitor
      ? 'Running on the stored charge in the capacitor — '
      : 'Circuit working — ';
    result.issues.push({
      level: 'good',
      text: bits.length ? prefix + bits.join(', ') + '.' : 'Current is flowing.'
    });
  }
}
