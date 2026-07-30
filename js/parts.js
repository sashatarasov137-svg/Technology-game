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
    mechanical: 'pulley',
    radius: 15,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: pulleyArt(15)
  },

  pulleyLarge: {
    name: 'Large pulley',
    group: 'mechanical',
    blurb: 'A bigger wheel for the belt. Bigger means slower and stronger.',
    mechanical: 'pulley',
    radius: 30,
    shafts: [{ id: 'hub', x: SHAFT.x, y: SHAFT.y }],
    art: pulleyArt(30)
  },

  rack: {
    name: 'Rack',
    group: 'mechanical',
    blurb: 'A toothed bar. Link a gear to it and spinning becomes straight-line pushing.',
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
  }
};


/* The drawer is grouped so twenty parts stay findable. */
const PALETTE_GROUPS = [
  { id: 'power',      title: 'Power',      types: ['battery', 'solar'] },
  { id: 'output',     title: 'Outputs',    types: ['led', 'bulb', 'buzzer', 'fan', 'motor'] },
  { id: 'control',    title: 'Control',    types: ['resistor', 'switch', 'button', 'pot', 'capacitor'] },
  { id: 'mechanical', title: 'Mechanical', types: ['gearSmall', 'gearMedium', 'gearLarge',
                                                   'pulleySmall', 'pulleyLarge', 'rack', 'wheel', 'lever'] }
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
