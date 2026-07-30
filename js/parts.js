/* ============================================================
   parts.js — the catalogue of components
   ------------------------------------------------------------
   Every part on the bench is described here once: how big it is,
   where its connection points sit, how it behaves, and what it
   looks like. Nothing in this file *does* anything — it is pure
   description, like a parts catalogue in a shop.

   Parts have two kinds of connection point:

     legs    round dots — carry electricity. Joined by wires.
     shafts  square dots — carry turning. Joined by drive links.

   You cannot wire a leg to a shaft, any more than you could
   solder a wire onto a spinning axle.
   ============================================================ */

/* Most parts are drawn in the same size box. Keeping them the
   same means wires always meet legs at a tidy height. */
const PART_W = 112;
const PART_H = 68;
const LEG_Y  = 34;          // legs sit halfway down the box
const HUB    = { x: 56, y: 34 };   // the centre a gear turns about
const SHAFT  = { x: 56, y: 6  };   // where its drive point is drawn

/* Resistance is measured in ohms (Ω). It means "how hard is it
   for electricity to push through this thing". A wire is 0.
   A big resistor is thousands. */


/* ------------------------------------------------------------
   Drawing a gear. Rather than hand-drawing every tooth, we work
   out the outline from the number of teeth: step around a circle
   and alternate between the outer radius (a tooth) and an inner
   one (the gap between teeth).
   ------------------------------------------------------------ */
function gearOutline(cx, cy, radius, teeth) {
  const root = radius * 0.76;
  const step = (Math.PI * 2) / teeth;
  const at = (angle, r) =>
    `${(cx + Math.cos(angle) * r).toFixed(1)} ${(cy + Math.sin(angle) * r).toFixed(1)}`;

  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    d += (i === 0 ? 'M' : 'L') + at(a, root)
       + 'L' + at(a + step * 0.18, radius)
       + 'L' + at(a + step * 0.42, radius)
       + 'L' + at(a + step * 0.60, root);
  }
  return d + 'Z';
}

function gearArt(radius, teeth) {
  return `
    <line x1="${SHAFT.x}" y1="${SHAFT.y}" x2="${SHAFT.x}" y2="${HUB.y - radius + 3}" class="shaft-stub"/>
    <g class="rotor">
      <path d="${gearOutline(HUB.x, HUB.y, radius, teeth)}" class="gear-body"/>
      <circle cx="${HUB.x}" cy="${HUB.y}" r="${(radius * 0.30).toFixed(1)}" class="gear-bore"/>
      <line x1="${HUB.x}" y1="${(HUB.y - radius * 0.72).toFixed(1)}"
            x2="${HUB.x}" y2="${(HUB.y - radius * 0.34).toFixed(1)}" class="gear-mark"/>
    </g>`;
}

function pulleyArt(radius) {
  return `
    <line x1="${SHAFT.x}" y1="${SHAFT.y}" x2="${SHAFT.x}" y2="${HUB.y - radius + 3}" class="shaft-stub"/>
    <g class="rotor">
      <circle cx="${HUB.x}" cy="${HUB.y}" r="${radius}" class="pulley-rim"/>
      <circle cx="${HUB.x}" cy="${HUB.y}" r="${radius - 4}" class="pulley-groove"/>
      <circle cx="${HUB.x}" cy="${HUB.y}" r="${(radius * 0.26).toFixed(1)}" class="gear-bore"/>
      <line x1="${HUB.x}" y1="${HUB.y - radius + 2}" x2="${HUB.x}" y2="${HUB.y - radius + 9}" class="gear-mark"/>
    </g>`;
}


const PARTS = {

  /* ========== POWER ======================================== */

  battery: {
    name: 'Battery',
    group: 'power',
    blurb: '9 volts. The power source — every circuit needs one.',
    lesson:
      'Inside a 9 V battery are six little cells stacked in a row, each one a sandwich of two different metals in a chemical paste. The chemistry pulls electrons off one metal and piles them onto the other, so one end ends up crowded with electrons and the other end short of them. That imbalance is the 9 volts. Join the two ends through a circuit and the electrons stream round to even things out — and that stream is your current. The battery goes flat when the chemicals are used up and there is nothing left to push with.',
    voltage: 9,
    resistance: 0,
    source: true,                 // only one power source at a time
    legs: [
      { id: 'pos', x: PART_W, y: LEG_Y, label: '+', polarity: 'pos' },
      { id: 'neg', x: 0,      y: LEG_Y, label: '−', polarity: 'neg' }
    ],
    art: `
      <rect x="18" y="14" width="76" height="40" rx="6" class="body-fill"/>
      <rect x="18" y="14" width="26" height="40" rx="6" class="accent-warm"/>
      <rect x="90" y="24" width="10" height="20" rx="3" class="accent-warm"/>
      <line x1="8"  y1="34" x2="18" y2="34" class="leg"/>
      <line x1="94" y1="34" x2="104" y2="34" class="leg"/>
      <text x="60" y="40" class="part-glyph">9V</text>`
  },

  solar: {
    name: 'Solar panel',
    group: 'power',
    blurb: 'Power from light instead of a battery. Drag the slider to move the sun.',
    lesson:
      'A solar cell is a wafer of silicon treated so that one face is hungry for electrons and the other has spares. When light lands on it, each packet of light knocks an electron loose, and the wafer\'s built-in imbalance pushes all those loose electrons the same way instead of letting them wander. That flow is the current. Twice the light means twice as many electrons knocked free, which is why the slider changes what the panel can do. A real panel is dozens of cells wired in a row to add their voltages up.',
    voltage: 9,                   // at full sun; scaled by the slider
    resistance: 0,
    source: true,
    slider: { prop: 'sun', min: 0, max: 100, step: 1, unit: '%' },
    legs: [
      { id: 'pos', x: PART_W, y: LEG_Y, label: '+', polarity: 'pos' },
      { id: 'neg', x: 0,      y: LEG_Y, label: '−', polarity: 'neg' }
    ],
    art: `
      <rect x="20" y="12" width="72" height="40" rx="4" class="solar-panel"/>
      <line x1="44" y1="12" x2="44" y2="52" class="solar-line"/>
      <line x1="68" y1="12" x2="68" y2="52" class="solar-line"/>
      <line x1="20" y1="32" x2="92" y2="32" class="solar-line"/>
      <g class="sun-rays">
        <circle cx="56" cy="6" r="5" class="sun-disc"/>
      </g>
      <line x1="8"  y1="34" x2="20" y2="34" class="leg"/>
      <line x1="92" y1="34" x2="104" y2="34" class="leg"/>`
  },


  /* ========== THINGS THAT DO SOMETHING ===================== */

  led: {
    name: 'LED',
    group: 'output',
    blurb: 'A tiny light. Only works one way round — + leg to the battery + side.',
    lesson:
      'LED stands for Light Emitting Diode. Inside is a speck of crystal where two differently treated layers meet. Electrons crossing that junction drop to a lower energy level, and the energy they lose comes straight back out as light — no heat-glow, no filament, which is why LEDs are so efficient. The junction only lets electrons cross one way, and that is exactly why an LED lights up one way round and stays dark the other. The colour is set by the crystal, not by the plastic.',
    resistance: 24,
    polarised: true,              // it cares which way round it is wired
    legs: [
      { id: 'anode',   x: 0,      y: LEG_Y, label: '+', role: 'anode'   },
      { id: 'cathode', x: PART_W, y: LEG_Y, label: '−', role: 'cathode' }
    ],
    art: `
      <circle cx="56" cy="30" r="24" class="led-halo"/>
      <path d="M40 44 L40 26 A16 16 0 0 1 72 26 L72 44 Z" class="led-dome-off"/>
      <path d="M40 44 L40 26 A16 16 0 0 1 72 26 L72 44 Z" class="led-dome-on"/>
      <path d="M40 44 L72 44" class="led-flat"/>
      <line x1="8"  y1="34" x2="40" y2="34" class="leg"/>
      <line x1="72" y1="34" x2="104" y2="34" class="leg"/>`
  },

  bulb: {
    name: 'Light bulb',
    group: 'output',
    blurb: 'A filament lamp. Brighter than an LED and it works either way round.',
    lesson:
      'A filament bulb works by brute force: a hair-thin coil of tungsten wire resists the current so hard that it heats to around 2,500°C and glows white. The glass is filled with an unreactive gas so the tungsten does not simply burn away. It is gloriously inefficient — the great majority of the energy leaves as heat rather than light — which is why LEDs have replaced them nearly everywhere. It does not care which way round it goes, because heating a wire works the same in both directions.',
    resistance: 180,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <circle cx="56" cy="28" r="26" class="bulb-halo"/>
      <circle cx="56" cy="28" r="17" class="bulb-glass"/>
      <circle cx="56" cy="28" r="17" class="bulb-glow"/>
      <path d="M49 33 L52 24 L56 32 L60 24 L63 33" class="filament"/>
      <rect x="48" y="43" width="16" height="9" rx="2" class="accent-steel"/>
      <line x1="8"  y1="34" x2="39" y2="34" class="leg"/>
      <line x1="73" y1="34" x2="104" y2="34" class="leg"/>`
  },

  buzzer: {
    name: 'Buzzer',
    group: 'output',
    blurb: 'Makes a sound whenever current flows through it.',
    lesson:
      'Inside is a thin disc of ceramic that physically changes shape when a voltage is applied to it. Swing the voltage back and forth thousands of times a second and the disc snaps in and out just as fast, punching the air and making a sound. Materials that do this are called piezoelectric, and the effect works both ways: squeeze the disc and it generates a small voltage instead. That is how some microphones and gas-lighter sparkers work.',
    resistance: 140,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <circle cx="56" cy="30" r="19" class="body-fill"/>
      <circle cx="56" cy="30" r="19" class="dial-ring"/>
      <circle cx="56" cy="30" r="4"  class="accent-steel"/>
      <path d="M70 20 Q78 30 70 40" class="sound-wave w1"/>
      <path d="M77 14 Q89 30 77 46" class="sound-wave w2"/>
      <line x1="8"  y1="34" x2="37" y2="34" class="leg"/>
      <line x1="75" y1="34" x2="104" y2="34" class="leg"/>`
  },

  fan: {
    name: 'Fan',
    group: 'output',
    blurb: 'Blows air when current flows. The more current, the stronger the draught.',
    lesson:
      'A fan is just a motor with blades bolted on. Each blade is set at an angle, so as it sweeps round it shoves air from one side to the other — the same trick as a boat\'s propeller. More current means the motor turns harder, the blades sweep faster, and more air gets moved each second. Note that a fan does not make cold air. It moves air past you so that heat leaves your skin faster, which is why a fan cools a person but not an empty room.',
    resistance: 110,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <circle cx="56" cy="30" r="21" class="dial-ring"/>
      <g class="rotor">
        <path d="M56 30 Q46 14 58 12 Q66 20 56 30" class="fan-blade"/>
        <path d="M56 30 Q72 20 74 32 Q66 40 56 30" class="fan-blade"/>
        <path d="M56 30 Q66 46 54 48 Q46 40 56 30" class="fan-blade"/>
        <path d="M56 30 Q40 40 38 28 Q46 20 56 30" class="fan-blade"/>
      </g>
      <circle cx="56" cy="30" r="4" class="accent-steel"/>
      <line x1="8"  y1="34" x2="35" y2="34" class="leg"/>
      <line x1="77" y1="34" x2="104" y2="34" class="leg"/>`
  },

  motor: {
    name: 'Motor',
    group: 'output',
    blurb: 'Turns electricity into movement. Its shaft (□) drives gears.',
    lesson:
      'Inside is a coil of wire sitting between two magnets. Run current through the coil and it becomes a magnet itself, so it is shoved round by the fixed magnets. Just as it lines up and would stop, a sliding contact flips the current the other way, so the coil is shoved onwards again — and it keeps chasing a position it can never reach. More current means a stronger magnetic shove, which means more turning force. That is why the bar along the bottom ties current, speed and force together.',
    resistance: 90,
    maxRpm: 300,                  // at full current
    maxTorque: 5,                 // newton-centimetres at full current
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    shafts: [
      { id: 'out', x: 56, y: 4 }
    ],
    art: `
      <circle cx="56" cy="34" r="19" class="body-fill"/>
      <circle cx="56" cy="34" r="19" class="dial-ring"/>
      <g class="rotor">
        <line x1="56" y1="20" x2="56" y2="48" class="rotor-blade"/>
        <line x1="42" y1="34" x2="70" y2="34" class="rotor-blade"/>
      </g>
      <circle cx="56" cy="34" r="4" class="accent-steel"/>
      <line x1="56" y1="15" x2="56" y2="6" class="shaft-stub"/>
      <line x1="8"  y1="34" x2="37" y2="34" class="leg"/>
      <line x1="75" y1="34" x2="104" y2="34" class="leg"/>`
  },


  /* ========== CONTROLLING THE CURRENT ====================== */

  resistor: {
    name: 'Resistor',
    group: 'control',
    blurb: 'Slows the current down so an LED does not burn out. Tap it to change its value.',
    lesson:
      'A resistor is a deliberately poor conductor — usually a film of carbon on a ceramic rod. The electrons keep bumping into things on the way through, which slows the flow and turns the lost energy into heat. Its whole job is to be in the way. The coloured bands are a code for its value: the first two are digits, the third says how many zeros to add. So brown-black-red is 1, 0, then two zeros, which is 1,000 Ω.',
    resistance: 470,
    values: [220, 470, 1000, 10000],   // tap the part to cycle through these
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <rect x="34" y="22" width="44" height="24" rx="10" class="accent-sand"/>
      <rect x="42" y="22" width="5" height="24" class="band-1"/>
      <rect x="52" y="22" width="5" height="24" class="band-2"/>
      <rect x="62" y="22" width="5" height="24" class="band-3"/>
      <line x1="8"  y1="34" x2="34" y2="34" class="leg"/>
      <line x1="78" y1="34" x2="104" y2="34" class="leg"/>`
  },

  switch: {
    name: 'Switch',
    group: 'control',
    blurb: 'Tap to flick it. Open = gap in the circuit, closed = current flows.',
    lesson:
      'The least mysterious part on the bench: two pieces of metal and a lever that either presses them together or holds them apart. Closed, the metals touch and electrons stroll across. Open, there is a gap of air, and air is such a poor conductor that at 9 V nothing crosses at all. That is the whole trick — a circuit is either a complete ring or it is nothing, and a switch decides which.',
    resistance: 0,
    toggle: true,
    startsClosed: false,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <rect x="30" y="30" width="52" height="14" rx="6" class="body-fill"/>
      <circle cx="38" cy="34" r="5" class="accent-steel"/>
      <circle cx="74" cy="34" r="5" class="accent-steel"/>
      <line x1="38" y1="34" x2="74" y2="34" class="lever"/>
      <line x1="8"  y1="34" x2="30" y2="34" class="leg"/>
      <line x1="82" y1="34" x2="104" y2="34" class="leg"/>`
  },

  button: {
    name: 'Push button',
    group: 'control',
    blurb: 'Only connects while you hold it down. Let go and the circuit breaks.',
    lesson:
      'The same two pieces of metal as a switch, but held apart by a small spring. Press it and you push the contacts together; let go and the spring pulls them back. That is what momentary means: it only counts while you are holding it. Doorbells, keyboard keys and the button on a game controller are all this, and the faint click you feel is a little metal dome popping through.',
    resistance: 0,
    momentary: true,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <rect x="34" y="18" width="44" height="34" rx="6" class="body-fill"/>
      <circle cx="56" cy="34" r="13" class="accent-steel"/>
      <circle cx="56" cy="34" r="9"  class="btn-cap"/>
      <line x1="8"  y1="34" x2="34" y2="34" class="leg"/>
      <line x1="78" y1="34" x2="104" y2="34" class="leg"/>`
  },

  pot: {
    name: 'Dial',
    group: 'control',
    blurb: 'A potentiometer. Slide it to change its resistance and dim a light.',
    lesson:
      'A potentiometer is a curved strip of resistive material with a wiper that slides along it. Move the wiper and you change how much of that strip the current has to fight its way through — a little at one end, all of it at the other. It is a resistor you can change by hand. Every volume knob, dimmer switch and joystick works this way, and the fact that it changes smoothly rather than in steps is exactly why they suit sliders and dials.',
    resistance: 1000,
    slider: { prop: 'resistance', min: 0, max: 10000, step: 50, unit: 'Ω' },
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <circle cx="56" cy="30" r="18" class="body-fill"/>
      <circle cx="56" cy="30" r="18" class="dial-ring"/>
      <line x1="56" y1="30" x2="56" y2="16" class="dial-needle"/>
      <line x1="8"  y1="34" x2="38" y2="34" class="leg"/>
      <line x1="74" y1="34" x2="104" y2="34" class="leg"/>`
  },

  capacitor: {
    name: 'Capacitor',
    group: 'control',
    blurb: 'Stores electricity like a tiny rechargeable battery, then gives it back.',
    lesson:
      'Two metal plates with an insulator between them, rolled up to save space. Electrons pile onto one plate and are pushed off the other, so charge builds up without ever crossing the gap. As it fills it pushes back harder against the source, which is why the current into it tails off rather than stopping suddenly. Cut the power and all that stored charge flows back out, which is what keeps your light glowing for a moment. Bigger plates store more, which is what the µF number means.',
    resistance: 0.5,              // a small real-world losses figure
    capacitor: true,
    capacitance: 2200,            // microfarads
    values: [470, 1000, 2200, 4700],
    polarised: true,
    legs: [
      { id: 'anode',   x: 0,      y: LEG_Y, label: '+', role: 'anode'   },
      { id: 'cathode', x: PART_W, y: LEG_Y, label: '−', role: 'cathode' }
    ],
    art: `
      <rect x="40" y="12" width="32" height="42" rx="5" class="cap-body"/>
      <rect x="40" y="12" width="32" height="42" rx="5" class="cap-fill"/>
      <line x1="63" y1="16" x2="63" y2="50" class="cap-stripe"/>
      <line x1="8"  y1="34" x2="40" y2="34" class="leg"/>
      <line x1="72" y1="34" x2="104" y2="34" class="leg"/>`
  },


  /* ========== MECHANICAL ===================================
     These carry turning, not electricity. Link a gear to the
     motor's shaft and it spins; link gears together and they
     trade speed for turning force.
     ======================================================== */

  gearSmall: {
    name: 'Small gear',
    group: 'mechanical',
    blurb: '8 teeth. Driven by a big gear it spins fast, but with little force.',
    lesson:
      'A gear is a wheel with teeth cut into it so that it cannot slip. When two gears mesh, every tooth that leaves one has to be replaced by a tooth on the other, so the tooth counts set everything. A small gear driving a large one has to turn several times for each single turn of the big one — so the big one goes slower, and slower means stronger. This is a trade with no free lunch: whatever you divide the speed by, you multiply the force by.',
    mechanical: 'gear',
    teeth: 8,
    radius: 16,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: gearArt(16, 8)
  },

  gearMedium: {
    name: 'Medium gear',
    group: 'mechanical',
    blurb: '16 teeth. Twice the small gear, so it turns at half the speed.',
    lesson:
      'The same idea as any gear, but sixteen teeth instead of eight. Put it between two other gears and it acts as an idler: it does not change the overall ratio at all, but it does flip the direction back, because each mesh reverses which way things turn. Gearboxes are full of gears doing nothing but reversing, spacing or bridging a gap.',
    mechanical: 'gear',
    teeth: 16,
    radius: 24,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: gearArt(24, 16)
  },

  gearLarge: {
    name: 'Large gear',
    group: 'mechanical',
    blurb: '24 teeth. Slow but strong — this is how you gear down for power.',
    lesson:
      'Twenty-four teeth. Driven by the eight-tooth gear it turns three times slower with three times the turning force — the classic way to gear down for power. This is why a hand drill has a gearbox, why a mountain bike has a big rear sprocket for hills, and why the motor in an electric window is tiny but can still shift a heavy pane of glass.',
    mechanical: 'gear',
    teeth: 24,
    radius: 31,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: gearArt(31, 24)
  },

  pulleySmall: {
    name: 'Small pulley',
    group: 'mechanical',
    blurb: 'Link two pulleys and a belt runs between them, like a bicycle chain.',
    lesson:
      'A pulley is a wheel with a groove for a belt. It does the same job as a gear, but across a gap rather than tooth to tooth, and it uses the radius rather than a tooth count to set the ratio. Because the belt runs round the outside of both wheels, they turn the same way — unlike meshed gears, which always oppose each other. A belt can also slip, which sounds like a flaw but is sometimes deliberate: it lets things skid rather than break.',
    mechanical: 'pulley',
    radius: 15,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: pulleyArt(15)
  },

  pulleyLarge: {
    name: 'Large pulley',
    group: 'mechanical',
    blurb: 'A bigger wheel for the belt. Bigger means slower and stronger.',
    lesson:
      'The bigger wheel of a belt pair. Twice the radius means half the speed and twice the turning force, exactly like gearing down. Belts and pulleys are what drive the alternator in a car engine, the drum of a washing machine, and the blades of a big fan — anywhere the turning has to travel some distance and a little quiet flexibility is welcome.',
    mechanical: 'pulley',
    radius: 30,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: pulleyArt(30)
  },

  rack: {
    name: 'Rack',
    group: 'mechanical',
    blurb: 'A toothed bar. Link a gear to it and spinning becomes straight-line pushing.',
    lesson:
      'A rack is a gear unrolled into a straight bar. The round gear driving it is called the pinion, and as the pinion turns its teeth walk the rack along. So rotation becomes a straight-line push. How fast the bar moves depends on the size of the pinion, because a bigger gear covers more distance per turn. Car steering is rack and pinion: you turn a wheel, and a bar slides sideways to point the front tyres.',
    mechanical: 'rack',
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: `
      <g class="rack-slide">
        <rect x="6" y="34" width="100" height="16" rx="3" class="rack-bar"/>
        <g class="rack-teeth">
          <rect x="12" y="26" width="7" height="9" class="rack-tooth"/>
          <rect x="27" y="26" width="7" height="9" class="rack-tooth"/>
          <rect x="42" y="26" width="7" height="9" class="rack-tooth"/>
          <rect x="57" y="26" width="7" height="9" class="rack-tooth"/>
          <rect x="72" y="26" width="7" height="9" class="rack-tooth"/>
          <rect x="87" y="26" width="7" height="9" class="rack-tooth"/>
        </g>
      </g>
      <line x1="56" y1="26" x2="56" y2="8" class="shaft-stub"/>`
  },

  wheel: {
    name: 'Wheel',
    group: 'mechanical',
    blurb: 'Mount it on a shaft and it rolls along. Shows how fast it would travel.',
    lesson:
      'A wheel converts turning into travelling. In one full turn it covers exactly its own circumference along the ground — for a 3 cm wheel that is a bit under 19 cm. So a bigger wheel travels further per turn and therefore goes faster at the same rpm, but it needs more turning force to get going, for the same reason a long lever is harder to push. Gearing and wheel size are two knobs for the same trade-off.',
    mechanical: 'wheel',
    wheelRadius: 3,               // centimetres
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: `
      <g class="rotor">
        <circle cx="56" cy="38" r="27" class="tyre"/>
        <circle cx="56" cy="38" r="19" class="rim"/>
        <line x1="56" y1="19" x2="56" y2="57" class="spoke"/>
        <line x1="37" y1="38" x2="75" y2="38" class="spoke"/>
        <line x1="43" y1="25" x2="69" y2="51" class="spoke"/>
        <line x1="69" y1="25" x2="43" y2="51" class="spoke"/>
      </g>
      <circle cx="56" cy="38" r="5" class="accent-steel"/>
      <line x1="56" y1="6" x2="56" y2="14" class="shaft-stub"/>`
  },

  lever: {
    name: 'Lever',
    group: 'mechanical',
    blurb: 'A long arm multiplies force. Slide it to change the arm length.',
    lesson:
      'The oldest machine there is. A lever pivots about a point, and force applied far from the pivot has far more effect than the same force applied close to it. Turn that round and you get the version used here: for a given turning force, a short arm pushes hard over a small distance, and a long arm pushes gently over a large one. Crowbars, scissors, wheelbarrows, your own forearm — all levers, all trading distance for force.',
    mechanical: 'lever',
    slider: { prop: 'arm', min: 2, max: 14, step: 0.5, unit: ' cm' },
    arm: 6,
    shafts: [{ id: 'hub', x: 22, y: 8 }],

    art: `
      <g class="lever-arm">
        <rect x="18" y="38" width="82" height="9" rx="4" class="lever-beam"/>
        <circle cx="96" cy="42" r="7" class="lever-tip"/>
      </g>
      <path d="M22 44 L12 60 L32 60 Z" class="lever-pivot"/>
      <line x1="22" y1="38" x2="22" y2="10" class="shaft-stub"/>`
  },

  buggy: {
    name: 'Buggy',
    group: 'mechanical',
    blurb: 'A little cart. Drive its shaft and it goes. Tap it to raise a hill and see if it can climb.',
    lesson:
      'The buggy puts everything together: current turns the motor, the motor turns the gears, and the gears turn the wheels that carry it along. It needs a certain amount of force at the wheels just to overcome friction, and far more to climb a slope. Gear up and it is quick on the flat but has nowhere near the force for the hill. Gear down and it crawls, but it climbs. There is no setting that is best at both, which is precisely why real vehicles have several gears and change between them.',
    mechanical: 'buggy',
    wheelRadius: 2.5,             // centimetres
    rollingForce: 0.5,            // newtons needed just to get moving
    hillForce: 3.0,               // newtons needed to climb the slope
    toggleHill: true,             // tap the part to raise and lower the hill
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: `
      <line x1="56" y1="6" x2="56" y2="20" class="shaft-stub"/>
      <g class="buggy-scene">
        <rect x="20" y="20" width="72" height="20" rx="5" class="buggy-body"/>
        <rect x="34" y="12" width="34" height="10" rx="3" class="buggy-cab"/>
        <g class="buggy-wheel wheel-front">
          <circle cx="74" cy="46" r="11" class="tyre"/>
          <circle cx="74" cy="46" r="5" class="rim"/>
          <line x1="74" y1="35" x2="74" y2="57" class="spoke"/>
          <line x1="63" y1="46" x2="85" y2="46" class="spoke"/>
        </g>
        <g class="buggy-wheel wheel-rear">
          <circle cx="38" cy="46" r="11" class="tyre"/>
          <circle cx="38" cy="46" r="5" class="rim"/>
          <line x1="38" y1="35" x2="38" y2="57" class="spoke"/>
          <line x1="27" y1="46" x2="49" y2="46" class="spoke"/>
        </g>
        <line x1="-40" y1="58" x2="152" y2="58" class="buggy-ground"/>
      </g>`
  }
};


/* The drawer is grouped so twenty parts stay findable. */
const PALETTE_GROUPS = [
  { id: 'power',      title: 'Power',      types: ['battery', 'solar'] },
  { id: 'output',     title: 'Outputs',    types: ['led', 'bulb', 'buzzer', 'fan', 'motor'] },
  { id: 'control',    title: 'Control',    types: ['resistor', 'switch', 'button', 'pot', 'capacitor'] },
  { id: 'mechanical', title: 'Mechanical', types: ['gearSmall', 'gearMedium', 'gearLarge',
                                                   'pulleySmall', 'pulleyLarge', 'rack', 'wheel', 'lever', 'buggy'] }
];

const PALETTE_ORDER = PALETTE_GROUPS.flatMap(g => g.types);

/* Every connection point on a part, of either kind. */
function nodesOf(type) {
  const spec = PARTS[type];
  return [
    ...(spec.legs   || []).map(n => ({ ...n, kind: 'leg'   })),
    ...(spec.shafts || []).map(n => ({ ...n, kind: 'shaft' }))
  ];
}

function nodeOf(type, id) {
  return nodesOf(type).find(n => n.id === id);
}


/* ---- turning raw numbers into readable labels -------------- */

function formatCurrent(amps) {
  if (amps <= 0) return '0 mA';
  const mA = amps * 1000;
  return mA < 1 ? mA.toFixed(2) + ' mA' : mA.toFixed(1) + ' mA';
}

function formatOhms(ohms) {
  if (ohms >= 1000) return (ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1) + ' kΩ';
  return Math.round(ohms) + ' Ω';
}

function formatRpm(rpm)      { return rpm.toFixed(rpm < 10 ? 1 : 0) + ' rpm'; }
function formatTorque(ncm)   { return ncm.toFixed(ncm < 10 ? 2 : 1) + ' N·cm'; }
function formatSpeed(cms)    { return cms.toFixed(1) + ' cm/s'; }
function formatForce(n)      { return n.toFixed(2) + ' N'; }
function formatVolts(v)      { return v.toFixed(1) + ' V'; }

/* 3 and 1 becomes "3:1" — the way gear ratios are always written. */
function formatRatio(ratio) {
  if (!isFinite(ratio) || ratio <= 0) return '—';
  return ratio >= 1
    ? ratio.toFixed(ratio % 1 === 0 ? 0 : 2) + ':1'
    : '1:' + (1 / ratio).toFixed((1 / ratio) % 1 === 0 ? 0 : 2);
}
