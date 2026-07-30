/* ============================================================
   parts.js — the catalogue of components
   ------------------------------------------------------------
   Every part on the bench is described here once: how big it is,
   where its legs sit, how much it resists electricity, and what
   it looks like. Nothing in this file *does* anything — it is
   pure description, like a parts catalogue in a shop.
   ============================================================ */

/* Every part is drawn in the same size box. Keeping them
   identical means wires always meet legs at a tidy height. */
const PART_W = 112;
const PART_H = 68;
const LEG_Y  = 34;          // legs sit halfway down the box

/* Resistance is measured in ohms (Ω). It means "how hard is it
   for electricity to push through this thing". A wire is 0.
   A big resistor is thousands. */

const PARTS = {

  battery: {
    name: 'Battery',
    blurb: '9 volts. The power source — every circuit needs one.',
    voltage: 9,
    resistance: 0,
    unique: true,                 // only one battery allowed at a time
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

  led: {
    name: 'LED',
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

  resistor: {
    name: 'Resistor',
    blurb: 'Slows the current down so an LED does not burn out. Click it to change its value.',
    resistance: 470,
    values: [220, 470, 1000, 10000],   // click the part to cycle through these
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
    blurb: 'Click to flick it. Open = gap in the circuit, closed = current flows.',
    resistance: 0,
    toggle: true,                 // has an on/off state you can click
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
    blurb: 'Only connects while you hold it down. Let go and the circuit breaks.',
    resistance: 0,
    momentary: true,              // closed only while pressed
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
    blurb: 'A potentiometer. Turn the slider to change its resistance and dim an LED.',
    resistance: 1000,
    variable: true,               // drag its slider from 0 to max
    minR: 0,
    maxR: 10000,
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

  buzzer: {
    name: 'Buzzer',
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

  motor: {
    name: 'Motor',
    blurb: 'Spins when current flows. The more current, the faster it turns.',
    resistance: 90,
    legs: [
      { id: 'a', x: 0,      y: LEG_Y },
      { id: 'b', x: PART_W, y: LEG_Y }
    ],
    art: `
      <circle cx="56" cy="30" r="19" class="body-fill"/>
      <circle cx="56" cy="30" r="19" class="dial-ring"/>
      <g class="rotor">
        <line x1="56" y1="16" x2="56" y2="44" class="rotor-blade"/>
        <line x1="42" y1="30" x2="70" y2="30" class="rotor-blade"/>
      </g>
      <circle cx="56" cy="30" r="4" class="accent-steel"/>
      <line x1="8"  y1="34" x2="37" y2="34" class="leg"/>
      <line x1="75" y1="34" x2="104" y2="34" class="leg"/>`
  }
};

/* The order parts appear in the drawer on the left. */
const PALETTE_ORDER = ['battery', 'led', 'resistor', 'switch', 'button', 'pot', 'buzzer', 'motor'];

/* Turn 0.0184 amps into "18 mA", 10000 ohms into "10 kΩ" — the
   short forms electronics people actually use. */
function formatCurrent(amps) {
  if (amps <= 0) return '0 mA';
  const mA = amps * 1000;
  return mA < 1 ? mA.toFixed(2) + ' mA' : mA.toFixed(1) + ' mA';
}

function formatOhms(ohms) {
  if (ohms >= 1000) return (ohms / 1000).toFixed(ohms % 1000 === 0 ? 0 : 1) + ' kΩ';
  return Math.round(ohms) + ' Ω';
}
