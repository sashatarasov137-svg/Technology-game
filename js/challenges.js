/* ============================================================
   challenges.js — the lessons
   ------------------------------------------------------------
   Each challenge is a small goal with a `check` function. Many
   times a second the app runs every check against your bench,
   and the moment one returns true, that challenge is ticked off.

   Some goals need memory. "Turn an LED off and on with a switch"
   can never be true in a single instant — you have to have seen
   both states. So we keep a `memory` object that records what
   has happened, and those checks look at that instead.
   ============================================================ */

/* --- small helpers for reading the simulation ------------- */

// Every part of a given type sitting inside this loop.
function loopParts(loop, parts, type) {
  return loop.partIds
    .map(id => parts.find(p => p.id === id))
    .filter(p => p && p.type === type);
}

// Loops that are actually carrying current right now.
function poweredLoops(sim) {
  return sim.loops.filter(l => l.blockedBy.length === 0 && l.current > 0);
}

function isLit(sim, part) {
  return sim.partState[part.id] && sim.partState[part.id].brightness > 0.05;
}


/* --- the memory of what the learner has managed so far ---- */

function freshMemory() {
  return {
    switchOn: false,  switchOff: false,
    buttonOn: false,  buttonOff: false,
    dimLow: null,     dimHigh: null
  };
}

/* Called on every simulation tick to update that memory. */
function observe(memory, parts, sim) {

  for (const loop of sim.loops) {
    const leds     = loopParts(loop, parts, 'led');
    const switches = loopParts(loop, parts, 'switch');
    const buttons  = loopParts(loop, parts, 'button');
    const pots     = loopParts(loop, parts, 'pot');
    if (leds.length === 0) continue;

    const live = loop.blockedBy.length === 0 && loop.current > 0;
    const litHere = leds.some(led => isLit(sim, led));
    const blockedByType = t => loop.blockedBy.some(b => {
      const p = parts.find(x => x.id === b.partId);
      return p && p.type === t && b.reason === 'open';
    });

    // A switch in the same loop as an LED: did we see both states?
    if (switches.length) {
      if (live && litHere)      memory.switchOn  = true;
      if (blockedByType('switch')) memory.switchOff = true;
    }

    // Same idea for a push button.
    if (buttons.length) {
      if (live && litHere)      memory.buttonOn  = true;
      if (blockedByType('button')) memory.buttonOff = true;
    }

    // A dial in the loop: track the dimmest and brightest we saw.
    if (pots.length && live) {
      const b = Math.max(...leds.map(led => sim.partState[led.id].brightness));
      memory.dimLow  = (memory.dimLow  === null) ? b : Math.min(memory.dimLow,  b);
      memory.dimHigh = (memory.dimHigh === null) ? b : Math.max(memory.dimHigh, b);
    }
  }
}


/* --- the challenges themselves, in teaching order --------- */

const CHALLENGES = [
  {
    id: 'first-light',
    title: 'First light',
    brief: 'Get a single LED to glow.',
    hint: 'Add a battery, a resistor and an LED. Wire the battery + to the resistor, the resistor to the LED + leg, and the LED − leg back to the battery −.',
    check: (parts, sim) => parts.some(p => p.type === 'led' && isLit(sim, p))
  },
  {
    id: 'play-it-safe',
    title: 'Play it safe',
    brief: 'Light an LED with a resistor protecting it, and no overload warning.',
    hint: 'A resistor has to sit in the same loop as the LED. Aim for a current under 40 mA — the 470 Ω resistor is a good choice.',
    check: (parts, sim) => poweredLoops(sim).some(loop => {
      const leds = loopParts(loop, parts, 'led');
      const res  = loopParts(loop, parts, 'resistor');
      return res.length > 0 && leds.some(l => isLit(sim, l) && !sim.partState[l.id].overloaded);
    })
  },
  {
    id: 'flip-the-switch',
    title: 'Flip the switch',
    brief: 'Put a switch in the loop, then turn your LED off and back on.',
    hint: 'Wire the switch in line with the LED, then click the switch. Open = gap = light off. Closed = light on.',
    check: (parts, sim, memory) => memory.switchOn && memory.switchOff
  },
  {
    id: 'hold-it',
    title: 'Hold it',
    brief: 'Control an LED with a push button — press and release it.',
    hint: 'A push button only closes the circuit while you hold the mouse down on it. Wire it in line with the LED and try.',
    check: (parts, sim, memory) => memory.buttonOn && memory.buttonOff
  },
  {
    id: 'dim-it',
    title: 'Dim it',
    brief: 'Use the dial to fade an LED between bright and dim.',
    hint: 'Wire the dial into the loop with the LED, then drag its slider. More resistance means less current, which means a dimmer light.',
    check: (parts, sim, memory) =>
      memory.dimHigh !== null && memory.dimHigh > 0.55 && (memory.dimHigh - memory.dimLow) > 0.3
  },
  {
    id: 'two-in-a-row',
    title: 'Two in a row',
    brief: 'Light two LEDs in the same loop, one after the other.',
    hint: 'Wiring parts one after another is called a series circuit. The same current passes through both, so they share the battery and each glows a little less.',
    check: (parts, sim) => poweredLoops(sim).some(loop => {
      const leds = loopParts(loop, parts, 'led');
      return leds.length >= 2 && leds.filter(l => isLit(sim, l)).length >= 2;
    })
  },
  {
    id: 'make-noise',
    title: 'Make some noise',
    brief: 'Get the buzzer sounding.',
    hint: 'A buzzer wires up just like an LED but it does not care which way round it goes. Put it in a complete loop with the battery.',
    check: (parts, sim) => parts.some(p => p.type === 'buzzer' && sim.partState[p.id].sounding)
  },
  {
    id: 'spin-up',
    title: 'Spin it up',
    brief: 'Make the motor turn.',
    hint: 'A motor needs a decent amount of current. Wire it straight into the loop — a big resistor will starve it and it will sit still.',
    check: (parts, sim) => parts.some(p => p.type === 'motor' && sim.partState[p.id].spinning > 0)
  },

  /* ---- more electrical ---- */

  {
    id: 'light-the-lamp',
    title: 'Light the lamp',
    brief: 'Get the filament bulb glowing.',
    hint: 'Unlike an LED, a bulb has no + or − leg, so it works either way round. It also has enough resistance of its own that it will not burn out.',
    check: (parts, sim) => parts.some(p => p.type === 'bulb' && sim.partState[p.id].brightness > 0.05)
  },
  {
    id: 'sun-power',
    title: 'Power from the sun',
    brief: 'Run a light from the solar panel instead of a battery.',
    hint: 'Remove the battery first — one power source at a time. Then wire the solar panel up like a battery and slide the sun up.',
    check: (parts, sim) => {
      const solar = parts.find(p => p.type === 'solar');
      if (!solar || !sim.powered) return false;
      return parts.some(p => (p.type === 'led' || p.type === 'bulb')
                             && sim.partState[p.id].brightness > 0.05);
    }
  },
  {
    id: 'store-it',
    title: 'Store it up',
    brief: 'Charge a capacitor, then let it keep a light on by itself.',
    hint: 'Wire a switch, then a capacitor across the light. Close the switch to fill the capacitor, then open it — the light fades instead of going straight out.',
    check: (parts, sim) => sim.runningOnCapacitor
      && parts.some(p => (p.type === 'led' || p.type === 'bulb')
                         && sim.partState[p.id].brightness > 0.05)
  },

  /* ---- mechanical ---- */

  {
    id: 'get-turning',
    title: 'Get it turning',
    brief: 'Use the motor to drive a gear.',
    hint: 'The motor has a square drive shaft on top. Tap it, then tap a gear — square points link to square points, never to wires.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical && sim.partState[p.id].rpm > 0)
  },
  {
    id: 'gear-down',
    title: 'Gear down for power',
    brief: 'Build a gear chain that turns at least 2 times slower than the motor.',
    hint: 'Drive a small gear from the motor and mesh it into a large one. The big gear turns slower but with much more force — the bar along the bottom tells you the ratio.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical
      && sim.partState[p.id].driven && sim.partState[p.id].ratio >= 2)
  },
  {
    id: 'gear-up',
    title: 'Gear up for speed',
    brief: 'Now do the opposite — make something spin faster than the motor.',
    hint: 'Turn the chain around: drive the large gear from the motor and mesh it into a small one. You gain speed but lose turning force.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical
      && sim.partState[p.id].driven && sim.partState[p.id].ratio > 0
      && sim.partState[p.id].ratio <= 0.6)
  },
  {
    id: 'belt-drive',
    title: 'Belt drive',
    brief: 'Send the turning across a belt between two pulleys.',
    hint: 'Link two pulleys shaft to shaft and a belt runs between them. Unlike meshed gears, both pulleys turn the same way.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical === 'pulley'
      && sim.partState[p.id].linkKind === 'belt' && sim.partState[p.id].rpm > 0)
  },
  {
    id: 'straight-line',
    title: 'Round into straight',
    brief: 'Drive the rack so it slides along.',
    hint: 'Link a gear to the rack. Spinning becomes straight-line pushing — the same trick that steers a car.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical === 'rack'
      && sim.partState[p.id].linear > 0.1)
  },
  {
    id: 'roll-on',
    title: 'Get rolling',
    brief: 'Drive a wheel and see how fast it would travel.',
    hint: 'Link a wheel onto the end of your gear chain and it rolls along with it.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical === 'wheel'
      && sim.partState[p.id].rpm > 0)
  },
  {
    id: 'take-a-drive',
    title: 'Take it for a drive',
    brief: 'Get the buggy rolling along the flat.',
    hint: 'Link your gear chain to the buggy\'s shaft. On the flat it barely needs any force, so almost any gearing will do.',
    check: (parts, sim) => parts.some(p => p.type === 'buggy'
      && sim.partState[p.id].driven && !sim.partState[p.id].stalled
      && !sim.partState[p.id].onHill && sim.partState[p.id].linear > 0)
  },
  {
    id: 'climb-the-hill',
    title: 'Climb the hill',
    brief: 'Tap the buggy to raise the hill, then get it up there.',
    hint: 'The slope needs far more force than the flat. Gear down — a small gear driving a large one — and you trade the speed you do not need for the force you do.',
    check: (parts, sim) => parts.some(p => p.type === 'buggy'
      && sim.partState[p.id].driven && sim.partState[p.id].onHill
      && !sim.partState[p.id].stalled)
  },
  {
    id: 'lever-lift',
    title: 'Lever it up',
    brief: 'Drive a lever and get more than 0.4 N of force at its tip.',
    hint: 'Gear down first — more turning force means more push. Then shorten the lever arm with its slider, because a shorter arm concentrates the force.',
    check: (parts, sim) => parts.some(p => PARTS[p.type].mechanical === 'lever'
      && sim.partState[p.id].driven && sim.partState[p.id].force > 0.4)
  }
];
