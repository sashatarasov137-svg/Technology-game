/* ============================================================
   library.js — ready-made circuits, and broken ones to fix
   ------------------------------------------------------------
   Two lists of pre-built benches.

   EXAMPLES are working circuits you can open, poke at and change.
   Starting from something that already works and taking it apart
   is a much easier way in than an empty screen.

   PUZZLES are the same idea with one thing deliberately wrong.
   Finding a fault is most of what electronics actually is, and it
   is a skill you only get by doing it.

   A build is written as a list of parts with positions, a list of
   links between their connection points, and any starting values
   that differ from the default.
   ============================================================ */

/* Columns and rows that fit comfortably on a tablet screen. */
const COL = [60, 300, 540];
const ROW = [100, 280];


const EXAMPLES = [
  {
    id: 'torch',
    title: 'A torch',
    blurb: 'The simplest useful circuit there is: a switch, a resistor to protect the LED, and the LED itself.',
    build: {
      parts: [
        ['bat', 'battery',  COL[0], ROW[0]],
        ['sw',  'switch',   COL[1], ROW[0]],
        ['res', 'resistor', COL[2], ROW[0]],
        ['led', 'led',      COL[1], ROW[1]]
      ],
      state: { sw: { closed: true } },
      links: [
        ['bat', 'pos', 'sw',  'a'],
        ['sw',  'b',   'res', 'a'],
        ['res', 'b',   'led', 'anode'],
        ['led', 'cathode', 'bat', 'neg']
      ]
    }
  },
  {
    id: 'doorbell',
    title: 'A doorbell',
    blurb: 'A push button and a buzzer. It only sounds while the button is held — try holding it down.',
    build: {
      parts: [
        ['bat', 'battery', COL[0], ROW[0]],
        ['btn', 'button',  COL[1], ROW[0]],
        ['buz', 'buzzer',  COL[2], ROW[0]]
      ],
      links: [
        ['bat', 'pos', 'btn', 'a'],
        ['btn', 'b',   'buz', 'a'],
        ['buz', 'b',   'bat', 'neg']
      ]
    }
  },
  {
    id: 'dimmer',
    title: 'A dimmer lamp',
    blurb: 'A bulb with a dial in the loop. Slide the dial and watch the brightness follow the current.',
    build: {
      parts: [
        ['bat',  'battery', COL[0], ROW[0]],
        ['pot',  'pot',     COL[1], ROW[0]],
        ['bulb', 'bulb',    COL[2], ROW[0]]
      ],
      state: { pot: { resistance: 0 } },
      links: [
        ['bat',  'pos', 'pot',  'a'],
        ['pot',  'b',   'bulb', 'a'],
        ['bulb', 'b',   'bat',  'neg']
      ]
    }
  },
  {
    id: 'solar-light',
    title: 'A solar light',
    blurb: 'No battery at all — the panel makes the electricity. Drag its slider down to nightfall.',
    build: {
      parts: [
        ['sol', 'solar',    COL[0], ROW[0]],
        ['res', 'resistor', COL[1], ROW[0]],
        ['led', 'led',      COL[2], ROW[0]]
      ],
      links: [
        ['sol', 'pos', 'res', 'a'],
        ['res', 'b',   'led', 'anode'],
        ['led', 'cathode', 'sol', 'neg']
      ]
    }
  },
  {
    id: 'afterglow',
    title: 'A light that lingers',
    blurb: 'A capacitor fills up alongside the LED. Open the switch and the LED fades instead of snapping off.',
    build: {
      parts: [
        ['bat', 'battery',   COL[0], ROW[0]],
        ['sw',  'switch',    COL[1], ROW[0]],
        ['cap', 'capacitor', COL[2], ROW[0]],
        ['res', 'resistor',  COL[1], ROW[1]],
        ['led', 'led',       COL[2], ROW[1]]
      ],
      state: { sw: { closed: true } },
      links: [
        ['bat', 'pos', 'sw',  'a'],
        ['sw',  'b',   'cap', 'anode'],
        ['sw',  'b',   'res', 'a'],
        ['cap', 'cathode', 'bat', 'neg'],
        ['res', 'b',   'led', 'anode'],
        ['led', 'cathode', 'bat', 'neg']
      ]
    }
  },
  {
    id: 'geared-buggy',
    title: 'A geared buggy',
    blurb: 'Battery to motor to gears to wheels, geared down 3:1 so it has the force to climb. Tap the buggy to raise the hill.',
    build: {
      parts: [
        ['bat', 'battery',    COL[0], ROW[0]],
        ['sw',  'switch',     COL[1], ROW[0]],
        ['mot', 'motor',      COL[2], ROW[0]],
        ['g1',  'gearSmall',  COL[0], ROW[1]],
        ['g2',  'gearLarge',  COL[1], ROW[1]],
        ['bug', 'buggy',      COL[2], ROW[1]]
      ],
      state: { sw: { closed: true } },
      links: [
        ['bat', 'pos', 'sw',  'a'],
        ['sw',  'b',   'mot', 'a'],
        ['mot', 'b',   'bat', 'neg'],
        ['mot', 'out', 'g1',  'hub', 'drive'],
        ['g1',  'hub', 'g2',  'hub', 'drive'],
        ['g2',  'hub', 'bug', 'hub', 'drive']
      ]
    }
  }
];


/* ------------------------------------------------------------
   The broken ones. Each has exactly one fault, a goal that says
   when it has been put right, and an explanation revealed once
   it is fixed.
   ------------------------------------------------------------ */

const lit = (parts, sim, type = 'led') =>
  parts.some(p => p.type === type && sim.partState[p.id].brightness > 0.05);

const PUZZLES = [
  {
    id: 'backwards',
    title: 'It just will not light',
    brief: 'Everything is connected, the battery is fine, and the LED stays dark.',
    answer: 'The LED was in backwards. An LED only conducts one way, so its + leg has to face the battery\'s + side. Swapping which leg each wire went to fixed it.',
    check: (parts, sim) => lit(parts, sim),
    build: {
      parts: [
        ['bat', 'battery',  COL[0], ROW[0]],
        ['res', 'resistor', COL[1], ROW[0]],
        ['led', 'led',      COL[2], ROW[0]]
      ],
      links: [
        ['bat', 'pos', 'res', 'a'],
        ['res', 'b',   'led', 'cathode'],     // the fault: wrong leg
        ['led', 'anode', 'bat', 'neg']
      ]
    }
  },
  {
    id: 'no-return',
    title: 'The current has nowhere to go',
    brief: 'The switch is closed and the parts are all in a row, but nothing happens at all.',
    answer: 'There was no way back. Electricity only flows in a complete ring, so the last part has to return to the battery\'s − leg. Without that final wire the whole thing is just a dead end.',
    check: (parts, sim) => lit(parts, sim),
    build: {
      parts: [
        ['bat', 'battery',  COL[0], ROW[0]],
        ['sw',  'switch',   COL[1], ROW[0]],
        ['res', 'resistor', COL[2], ROW[0]],
        ['led', 'led',      COL[1], ROW[1]]
      ],
      state: { sw: { closed: true } },
      links: [
        ['bat', 'pos', 'sw',  'a'],
        ['sw',  'b',   'res', 'a'],
        ['res', 'b',   'led', 'anode']        // the fault: no wire home
      ]
    }
  },
  {
    id: 'too-dim',
    title: 'Far too dim to be useful',
    brief: 'It works, but you can barely see it. Get the LED properly bright without overloading it.',
    answer: 'The resistor was 10 kΩ — twenty times more than this LED needs, so it was being starved of current. Tapping the resistor cycles through its values; 470 Ω gives a bright LED at a safe current.',
    check: (parts, sim) => parts.some(p => p.type === 'led'
      && sim.partState[p.id].brightness > 0.5 && !sim.partState[p.id].overloaded),
    build: {
      parts: [
        ['bat', 'battery',  COL[0], ROW[0]],
        ['res', 'resistor', COL[1], ROW[0]],
        ['led', 'led',      COL[2], ROW[0]]
      ],
      state: { res: { resistance: 10000, valueIndex: 3 } },   // the fault
      links: [
        ['bat', 'pos', 'res', 'a'],
        ['res', 'b',   'led', 'anode'],
        ['led', 'cathode', 'bat', 'neg']
      ]
    }
  },
  {
    id: 'no-resistor',
    title: 'Bright, but it keeps warning me',
    brief: 'The LED lights up, but SparkLab says it would burn out. There is a spare resistor on the bench.',
    answer: 'Nothing was limiting the current. An LED has almost no resistance of its own, so wired straight across a battery it takes hundreds of milliamps instead of about twenty, and in real life it would die instantly. Putting the resistor into the loop fixed it.',
    check: (parts, sim) => parts.some(p => p.type === 'led'
      && sim.partState[p.id].brightness > 0.05 && !sim.partState[p.id].overloaded),
    build: {
      parts: [
        ['bat', 'battery',  COL[0], ROW[0]],
        ['led', 'led',      COL[1], ROW[0]],
        ['res', 'resistor', COL[1], ROW[1]]   // spare, deliberately unwired
      ],
      links: [
        ['bat', 'pos', 'led', 'anode'],       // the fault: nothing in the way
        ['led', 'cathode', 'bat', 'neg']
      ]
    }
  },
  {
    id: 'no-drive',
    title: 'The motor runs but the gears do not',
    brief: 'You can hear it going, the gears are meshed together, and yet they sit perfectly still.',
    answer: 'The motor was never linked to the gears. Its turning leaves through the square shaft on top, and that had no drive link running from it — so the gears had nothing driving them, however well they were meshed to each other.',
    check: (parts, sim) => parts.some(p => p.type === 'gearLarge' && sim.partState[p.id].rpm > 0),
    build: {
      parts: [
        ['bat', 'battery',   COL[0], ROW[0]],
        ['mot', 'motor',     COL[1], ROW[0]],
        ['g1',  'gearSmall', COL[1], ROW[1]],
        ['g2',  'gearLarge', COL[2], ROW[1]]
      ],
      links: [
        ['bat', 'pos', 'mot', 'a'],
        ['mot', 'b',   'bat', 'neg'],
        ['g1',  'hub', 'g2',  'hub', 'drive']  // the fault: motor not linked
      ]
    }
  },
  {
    id: 'wont-climb',
    title: 'The buggy cannot get up the hill',
    brief: 'It flies along on the flat, but faced with the slope it just sits there. Make it climb.',
    answer: 'It was geared the wrong way. The large gear was driving the small one, which makes it fast but leaves only a third of the turning force — nowhere near enough for the slope. Driving the large gear from the small one instead trades that speed back for the force it needs.',
    check: (parts, sim) => parts.some(p => p.type === 'buggy'
      && sim.partState[p.id].driven && sim.partState[p.id].onHill && !sim.partState[p.id].stalled),
    build: {
      parts: [
        ['bat', 'battery',   COL[0], ROW[0]],
        ['mot', 'motor',     COL[1], ROW[0]],
        ['g1',  'gearLarge', COL[0], ROW[1]],
        ['g2',  'gearSmall', COL[1], ROW[1]],
        ['bug', 'buggy',     COL[2], ROW[1]]
      ],
      state: { bug: { hill: true } },
      links: [
        ['bat', 'pos', 'mot', 'a'],
        ['mot', 'b',   'bat', 'neg'],
        ['mot', 'out', 'g1',  'hub', 'drive'],
        ['g1',  'hub', 'g2',  'hub', 'drive'],  // the fault: geared up, not down
        ['g2',  'hub', 'bug', 'hub', 'drive']
      ]
    }
  }
];
