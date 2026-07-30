/* ============================================================
   tests/circuit.test.js
   ------------------------------------------------------------
   Drives a real browser through SparkLab and checks that the
   electronics behave correctly: loops, Ohm's law, LED polarity,
   overload warnings, every challenge, and saving.

   You do NOT need this to use or publish the site. It is here so
   that if you change the code, you can check you did not break
   anything:

       npm install
       npm test

   It starts its own little web server, so nothing else is needed.
   ============================================================ */

const { chromium } = require('playwright');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

// A minimal static file server, just for the duration of the test.
function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ->  got ${got}${ok ? '' : `, want ${want}`}`);
}

(async () => {
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#helpClose');

  const add   = n => page.click(`.palette-item:has(.palette-name:text-is("${n}"))`).then(() => page.waitForTimeout(70));
  const tap   = s => page.click(s).then(() => page.waitForTimeout(60));
  const wire  = (a, b) => tap(a).then(() => tap(b));
  const snap  = () => page.evaluate(() => {
    const sim = simulate(state.parts, state.wires);
    const loops = sim.loops.filter(l => l.blockedBy.length === 0 && l.current > 0);
    return {
      wires: state.wires.length,
      loops: loops.length,
      ohms: loops.length ? Math.round(loops[0].resistance) : null,
      mA: loops.length ? +(loops[0].current * 1000).toFixed(1) : 0,
      ledBright: +Object.entries(sim.partState)
        .filter(([id]) => state.parts.find(p => p.id === id && p.type === 'led'))
        .reduce((m, [, s]) => Math.max(m, s.brightness), 0).toFixed(2),
      overloaded: Object.values(sim.partState).some(s => s.overloaded),
      reversed: Object.values(sim.partState).some(s => s.reversed),
      done: [...state.completed]
    };
  });
  // Click a wire where it is actually drawn, like a person would.
  const clickWire = async (which) => {
    const pt = await page.evaluate(w => {
      const paths = [...document.querySelectorAll('.wire-hit')];
      const path = w === 'first' ? paths[0] : paths[paths.length - 1];
      const p = path.getPointAtLength(path.getTotalLength() / 2);
      const box = document.getElementById('bench').getBoundingClientRect();
      return { x: box.left + p.x, y: box.top + p.y };
    }, which);
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(140);
  };
  const L = t => `.part-led .leg-dot[data-leg="${t}"]`;
  const B = t => `.part-battery .leg-dot[data-leg="${t}"]`;

  // === 1. LED straight across the battery: should be a wild overload ===
  await add('Battery'); await add('LED');
  await wire(B('pos'), L('anode'));
  await wire(L('cathode'), B('neg'));
  let s = await snap();
  check('1a  loop found',        s.loops, 1);
  check('1b  overload flagged',  s.overloaded, true);
  check('1c  current is huge',   s.mA > 300, true);
  check('1d  "First light" won', s.done.includes('first-light'), true);
  check('1e  "Play it safe" NOT won', s.done.includes('play-it-safe'), false);

  // === 2. Put a resistor in the loop ===
  await clickWire('first');   // cut battery+ -> LED+
  check('2a  wire deleted', (await snap()).wires, 1);
  await add('Resistor');
  await wire(B('pos'), '.part-resistor .leg-dot[data-leg="a"]');
  await wire('.part-resistor .leg-dot[data-leg="b"]', L('anode'));
  s = await snap();
  check('2b  one loop again',    s.loops, 1);
  check('2c  470 + 24 ohms',     s.ohms, 494);
  check('2d  ~18 mA',            s.mA > 15 && s.mA < 20, true);
  check('2e  no overload',       s.overloaded, false);
  check('2f  LED near full',     s.ledBright > 0.8, true);
  check('2g  "Play it safe" won',s.done.includes('play-it-safe'), true);

  // === 3. Resistor value cycles on click: 470 -> 1k -> 10k dims the LED ===
  await tap('.part-resistor .part-art');
  s = await snap();
  check('3a  now 1k',            s.ohms, 1024);
  await tap('.part-resistor .part-art');
  s = await snap();
  check('3b  now 10k',           s.ohms, 10024);
  check('3c  LED much dimmer',   s.ledBright < 0.1, true);
  await tap('.part-resistor .part-art');   // wrap back to 220
  check('3d  wraps to 220',      (await snap()).ohms, 244);
  await tap('.part-resistor .part-art');   // back to 470

  // === 4. LED backwards refuses to conduct ===
  await page.evaluate(() => state.wires.forEach(w => [w.from, w.to].forEach(e => {
    const p = state.parts.find(x => x.id === e.partId);
    if (p && p.type === 'led') e.legId = e.legId === 'anode' ? 'cathode' : 'anode';
  })));
  s = await snap();
  check('4a  no current flows',  s.loops, 0);
  check('4b  flagged reversed',  s.reversed, true);
  await page.evaluate(() => state.wires.forEach(w => [w.from, w.to].forEach(e => {
    const p = state.parts.find(x => x.id === e.partId);
    if (p && p.type === 'led') e.legId = e.legId === 'anode' ? 'cathode' : 'anode';
  })));

  // === 5. Switch: open breaks the loop, closed restores it ===
  await add('Switch');
  await clickWire('last');    // cut resistor -> LED
  await wire('.part-resistor .leg-dot[data-leg="b"]', '.part-switch .leg-dot[data-leg="a"]');
  await wire('.part-switch .leg-dot[data-leg="b"]', L('anode'));
  s = await snap();
  check('5a  open = dark',       s.loops, 0);
  await tap('.part-switch .part-art');
  s = await snap();
  check('5b  closed = lit',      s.loops, 1);
  check('5c  switch challenge',  s.done.includes('flip-the-switch'), true);

  // === 6. Push button: only closed while held ===
  await add('Push button');
  await clickWire('last');
  await wire('.part-switch .leg-dot[data-leg="b"]', '.part-button .leg-dot[data-leg="a"]');
  await wire('.part-button .leg-dot[data-leg="b"]', L('anode'));
  s = await snap();
  check('6a  released = dark',   s.loops, 0);
  const cap = await page.locator('.part-button .part-art').boundingBox();
  await page.mouse.move(cap.x + cap.width / 2, cap.y + cap.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(220);
  s = await snap();
  check('6b  held = lit',        s.loops, 1);
  await page.mouse.up();
  await page.waitForTimeout(200);
  s = await snap();
  check('6c  let go = dark',     s.loops, 0);
  check('6d  button challenge',  s.done.includes('hold-it'), true);

  // === 7. Dial dims the LED ===
  await add('Dial');
  await clickWire('last');
  await wire('.part-button .leg-dot[data-leg="b"]', '.part-pot .leg-dot[data-leg="a"]');
  await wire('.part-pot .leg-dot[data-leg="b"]', L('anode'));
  await page.mouse.move(cap.x + cap.width / 2, cap.y + cap.height / 2);
  await page.mouse.down();                      // hold the button down throughout
  await page.evaluate(() => { const p = state.parts.find(x => x.type === 'pot'); p.state.resistance = 0; });
  await page.waitForTimeout(220);
  const bright = (await snap()).ledBright;
  await page.evaluate(() => { const p = state.parts.find(x => x.type === 'pot'); p.state.resistance = 10000; });
  await page.waitForTimeout(220);
  const dim = (await snap()).ledBright;
  await page.mouse.up();
  check('7a  dial bright end',   bright > 0.8, true);
  check('7b  dial dim end',      dim < 0.2, true);
  check('7c  dial challenge',    (await snap()).done.includes('dim-it'), true);

  // === 8. Two LEDs in series ===
  await page.evaluate(() => clearBench());
  await add('Battery'); await add('Resistor'); await add('LED'); await add('LED');
  const leds = await page.$$eval('.part-led', els => els.map(e => e.dataset.id));
  await page.evaluate(([a, b]) => {
    const w = (fp, fl, tp, tl) => state.wires.push({ id: 'w' + (state.nextId++), from: { partId: fp, legId: fl }, to: { partId: tp, legId: tl } });
    const bat = state.parts.find(p => p.type === 'battery').id;
    const res = state.parts.find(p => p.type === 'resistor').id;
    w(bat, 'pos', res, 'a'); w(res, 'b', a, 'anode');
    w(a, 'cathode', b, 'anode'); w(b, 'cathode', bat, 'neg');
    rebuildWires();
  }, leds);
  await page.waitForTimeout(250);
  s = await snap();
  check('8a  series loop',       s.loops, 1);
  check('8b  both lit',          s.ledBright > 0.5, true);
  check('8c  series challenge',  s.done.includes('two-in-a-row'), true);

  // === 9. Buzzer + motor ===
  await add('Buzzer'); await add('Motor');
  await wire(B('pos'), '.part-buzzer .leg-dot[data-leg="a"]');
  await wire('.part-buzzer .leg-dot[data-leg="b"]', B('neg'));
  await wire(B('pos'), '.part-motor .leg-dot[data-leg="a"]');
  await wire('.part-motor .leg-dot[data-leg="b"]', B('neg'));
  await page.waitForTimeout(250);
  s = await snap();
  check('9a  buzzer challenge',  s.done.includes('make-noise'), true);
  check('9b  motor challenge',   s.done.includes('spin-up'), true);
  check('9c  all 8 complete',    s.done.length, 8);

  // === 10. Survives a reload ===
  const before = await snap();
  await page.reload();
  await page.waitForTimeout(400);
  const after = await snap();
  check('10a wires kept',        after.wires, before.wires);
  check('10b progress kept',     after.done.length, 8);
  check('10c still simulating',  after.loops > 0, true);

  // === 11. Short circuit is caught ===
  await page.evaluate(() => {
    clearBench();
    addPart('battery');
    const bat = state.parts[0].id;
    state.wires.push({ id: 'wx', from: { partId: bat, legId: 'pos' }, to: { partId: bat, legId: 'neg' } });
    rebuildWires();
  });
  await page.waitForTimeout(250);
  check('11a short warned', (await page.textContent('#statusText')).includes('Short circuit'), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors.');
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
