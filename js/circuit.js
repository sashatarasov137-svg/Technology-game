/* ============================================================
   circuit.js — the simulation
   ------------------------------------------------------------
   This is the brain. It is handed a list of parts and a list of
   wires, and it works out what the electricity does.

   The whole thing rests on one idea: electricity only flows in a
   complete loop. It has to leave the battery's + leg, travel
   through parts, and arrive back at the battery's − leg. If the
   loop is broken anywhere, nothing happens.

   So the job breaks into three steps:
     1. Work out which legs are joined together by wires.
     2. Find every complete loop from + back to −.
     3. For each loop, work out how much current flows.
   ============================================================ */

/* Some physical constants for our little world. */
const IDEAL_LED_CURRENT = 0.020;   // 20 mA — a happy, bright LED
const LED_BURN_CURRENT  = 0.045;   // 45 mA — in real life it dies
const MOTOR_MIN_CURRENT = 0.012;   // below this a motor won't turn
const BUZZER_MIN_CURRENT= 0.004;
const SHORT_RESISTANCE  = 3;       // a loop with less than this is a short circuit
const MIN_RESISTANCE    = 0.4;     // stops us dividing by zero


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

  function add(key) {
    if (!(key in parent)) parent[key] = key;
  }

  // Find which group a leg ended up in.
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

  // Every leg of every part starts alone.
  for (const part of parts) {
    for (const leg of PARTS[part.type].legs) add(legKey(part.id, leg.id));
  }

  // Every wire merges the two legs it joins.
  for (const wire of wires) {
    const a = legKey(wire.from.partId, wire.from.legId);
    const b = legKey(wire.to.partId, wire.to.legId);
    if (a in parent && b in parent) union(a, b);
  }

  return { netOf: (partId, legId) => find(legKey(partId, legId)) };
}


/* ------------------------------------------------------------
   How much does one part resist electricity right now?
   Infinity means "completely blocked" — an open switch is
   literally a gap in the circuit, so nothing can get through.
   ------------------------------------------------------------ */
function resistanceOf(part) {
  const spec = PARTS[part.type];
  if (spec.toggle)    return part.state.closed  ? 0 : Infinity;
  if (spec.momentary) return part.state.pressed ? 0 : Infinity;
  if (spec.variable)  return part.state.resistance;
  if (spec.values)    return part.state.resistance;
  return spec.resistance;
}


/* ------------------------------------------------------------
   Step 2: find every complete loop.

   We treat the circuit as a map: nets are places, parts are the
   roads between them. Starting at the battery's + net we walk
   every possible route until we arrive at the battery's − net,
   never using the same road or visiting the same place twice.
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
      const nextNet = (edge.a === net) ? edge.b : edge.a;
      if (edge.a === edge.b) continue;                       // part wired to itself

      // Note which way round we crossed this part — LEDs care.
      const step = { edge, enteredAt: net, backwards: (net !== edge.a) };

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


/* ------------------------------------------------------------
   The main entry point. Everything above gets used here.
   ------------------------------------------------------------ */
function simulate(parts, wires) {
  // A blank result we fill in as we learn things.
  const result = {
    hasBattery: false,
    partState: {},        // partId -> { current, brightness, spinning, ... }
    loops: [],            // every complete circle we found
    issues: [],           // problems worth telling the user about
    powered: false
  };

  for (const part of parts) {
    result.partState[part.id] = {
      current: 0, brightness: 0, spinning: 0, sounding: false,
      reversed: false, overloaded: false, inLoop: false
    };
  }

  const battery = parts.find(p => p.type === 'battery');
  if (!battery) {
    result.issues.push({ level: 'info', text: 'Add a battery — nothing works without a power source.' });
    return result;
  }
  result.hasBattery = true;

  const nets = buildNets(parts, wires);
  const posNet = nets.netOf(battery.id, 'pos');
  const negNet = nets.netOf(battery.id, 'neg');

  // The battery's two legs wired straight to each other: a dead short.
  if (posNet === negNet) {
    result.issues.push({ level: 'danger', text: 'Short circuit! The battery\'s + and − are joined with nothing in between. In real life the battery would get hot.' });
    return result;
  }

  // Build the "roads": one per part, joining the nets its legs sit in.
  const edges = [];
  for (const part of parts) {
    if (part.type === 'battery') continue;
    const spec = PARTS[part.type];
    const legA = spec.legs.find(l => l.role === 'anode') || spec.legs[0];
    const legB = spec.legs.find(l => l.role === 'cathode') || spec.legs[1];
    edges.push({
      partId: part.id,
      type: part.type,
      a: nets.netOf(part.id, legA.id),      // for an LED, 'a' is always the + leg
      b: nets.netOf(part.id, legB.id),
      resistance: resistanceOf(part),
      polarised: !!spec.polarised
    });
  }

  const rawLoops = findLoops(posNet, negNet, edges);

  if (rawLoops.length === 0) {
    result.issues.push({ level: 'info', text: 'No complete loop yet. Current must leave the battery\'s +, pass through your parts, and return to the −.' });
    return result;
  }

  /* ----------------------------------------------------------
     Step 3: work out the current in each loop.

     Ohm's law: current = voltage ÷ resistance. Add up the
     resistance of everything in the loop, divide the battery's
     9 volts by it, and that is how much current flows.
     ---------------------------------------------------------- */
  const voltage = PARTS.battery.voltage;

  for (const steps of rawLoops) {
    const loop = {
      partIds: steps.map(s => s.edge.partId),
      resistance: 0,
      current: 0,
      blockedBy: []
    };

    for (const step of steps) {
      const { edge, backwards } = step;
      result.partState[edge.partId].inLoop = true;

      // An LED wired the wrong way round simply refuses to conduct.
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
    }

    if (loop.blockedBy.length === 0) {
      loop.current = voltage / Math.max(loop.resistance, MIN_RESISTANCE);
      result.powered = true;
      // Each part carries the biggest current of any loop it sits in.
      for (const id of loop.partIds) {
        result.partState[id].current = Math.max(result.partState[id].current, loop.current);
      }
      if (loop.resistance < SHORT_RESISTANCE) loop.shorted = true;
    }

    result.loops.push(loop);
  }

  /* ----------------------------------------------------------
     Turn raw current into things you can see and hear.
     ---------------------------------------------------------- */
  for (const part of parts) {
    const st = result.partState[part.id];
    const amps = st.current;

    if (part.type === 'led') {
      st.brightness = Math.min(1, amps / IDEAL_LED_CURRENT);
      st.overloaded = amps > LED_BURN_CURRENT;
    }
    if (part.type === 'motor') {
      st.spinning = amps > MOTOR_MIN_CURRENT ? Math.min(1, amps / 0.09) : 0;
    }
    if (part.type === 'buzzer') {
      st.sounding = amps > BUZZER_MIN_CURRENT;
      st.volume = Math.min(1, amps / 0.06);
    }
  }

  /* ----------------------------------------------------------
     Finally: decide what to tell the user, worst problem first.
     ---------------------------------------------------------- */
  const shorted   = result.loops.some(l => l.shorted);
  const burning   = parts.filter(p => result.partState[p.id].overloaded);
  const reversed  = parts.filter(p => result.partState[p.id].reversed);
  const openOnly  = !result.powered && result.loops.every(l => l.blockedBy.length > 0);

  if (shorted) {
    result.issues.push({ level: 'danger', text: 'Short circuit! There is a loop with nothing to slow the current down. Put a resistor in it.' });
  }
  if (burning.length) {
    result.issues.push({ level: 'danger', text: 'Too much current through the LED — in real life it would burn out. Add a resistor in the loop with it.' });
  }
  if (reversed.length && !result.powered) {
    result.issues.push({ level: 'warn', text: 'That LED is the wrong way round. Its + leg has to face the battery\'s + leg.' });
  }
  if (openOnly && !reversed.length) {
    const opener = result.loops.flatMap(l => l.blockedBy).find(b => b.reason === 'open');
    const openPart = opener && parts.find(p => p.id === opener.partId);
    if (openPart && openPart.type === 'button') {
      result.issues.push({ level: 'info', text: 'Loop complete — now hold the push button down to close it.' });
    } else if (openPart) {
      result.issues.push({ level: 'info', text: 'Loop complete, but the switch is open. Click it to close the gap.' });
    }
  }
  if (result.powered && !shorted && !burning.length) {
    const lit = parts.filter(p => p.type === 'led' && result.partState[p.id].brightness > 0.05).length;
    const bits = [];
    if (lit) bits.push(lit === 1 ? '1 LED lit' : lit + ' LEDs lit');
    if (parts.some(p => p.type === 'motor'  && result.partState[p.id].spinning)) bits.push('motor spinning');
    if (parts.some(p => p.type === 'buzzer' && result.partState[p.id].sounding)) bits.push('buzzer sounding');
    result.issues.push({ level: 'good', text: bits.length ? 'Circuit working — ' + bits.join(', ') + '.' : 'Current is flowing.' });
  }

  return result;
}
