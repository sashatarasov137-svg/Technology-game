/* ============================================================
   tests/mechanics.test.js
   ------------------------------------------------------------
   Checks the gears, belts, racks, wheels and levers, plus the
   parts added alongside them: the bulb, fan, solar panel and
   capacitor.

   The important thing being checked is that gearing is a trade.
   Whenever a gear chain halves the speed it must double the
   turning force — if a change ever made both go up, the physics
   would be wrong and the app would be teaching a lie.

       npm test
   ============================================================ */

const { chromium } = require('playwright');
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

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
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

(async () => {
  const { server, port } = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#helpClose');

  /* Build a bench straight from a description: named parts, then
     the links between their connection points. */
  const build = layout => page.evaluate(spec => {
    clearBench();
    const ids = {};
    for (const [name, type] of spec.parts) {
      addPart(type);
      ids[name] = state.parts[state.parts.length - 1].id;
    }
    for (const [a, an, b, bn, kind] of spec.links) {
      state.wires.push({
        id: 'w' + (state.nextId++),
        kind: kind || 'wire',
        from: { partId: ids[a], legId: an },
        to:   { partId: ids[b], legId: bn }
      });
    }
    rebuildBench();
    return ids;
  }, layout);

  const read = ids => page.evaluate(map => {
    const sim = simulate(state.parts, state.wires, 0.016);
    simulateMechanics(state.parts, state.wires, sim);
    const out = { powered: sim.powered, runningOnCapacitor: sim.runningOnCapacitor, parts: {} };
    for (const [name, id] of Object.entries(map)) out.parts[name] = sim.partState[id];
    return out;
  }, ids);

  // A motor wired straight across the battery, ready to drive things.
  const motorRig = (extraParts = [], extraLinks = []) => ({
    parts: [['bat', 'battery'], ['mot', 'motor'], ...extraParts],
    links: [
      ['bat', 'pos', 'mot', 'a'],
      ['mot', 'b', 'bat', 'neg'],
      ...extraLinks
    ]
  });

  // ================================================================
  // 1. The motor drives a gear at its own speed
  // ================================================================
  let ids = await build(motorRig([['g1', 'gearSmall']], [['mot', 'out', 'g1', 'hub', 'drive']]));
  let r = await read(ids);
  check('1a  motor is running',      r.parts.mot.rpm > 0, true);
  check('1b  gear is driven',        r.parts.g1.driven, true);
  check('1c  gear matches motor',    near(r.parts.g1.rpm, r.parts.mot.rpm), true);
  check('1d  ratio is 1:1',          near(r.parts.g1.ratio, 1), true);
  const motorRpm = r.parts.mot.rpm, motorTorque = r.parts.mot.torque;

  // ================================================================
  // 2. Small gear (8 teeth) into large gear (24 teeth) = 3:1 down
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearSmall'], ['g2', 'gearLarge']],
    [['mot', 'out', 'g1', 'hub', 'drive'], ['g1', 'hub', 'g2', 'hub', 'drive']]
  ));
  r = await read(ids);
  check('2a  three times slower',    near(r.parts.g2.rpm, motorRpm / 3), true);
  check('2b  three times stronger',  near(r.parts.g2.torque, motorTorque * 3), true);
  check('2c  ratio reads 3:1',       near(r.parts.g2.ratio, 3), true);
  check('2d  meshed gears counter-rotate',
        Math.sign(r.parts.g2.direction), -Math.sign(r.parts.g1.direction));
  // The trade must be exact: speed x force is conserved.
  check('2e  no free energy',
        near(r.parts.g2.rpm * r.parts.g2.torque, motorRpm * motorTorque), true);

  // ================================================================
  // 3. The same chain reversed gears UP instead
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearLarge'], ['g2', 'gearSmall']],
    [['mot', 'out', 'g1', 'hub', 'drive'], ['g1', 'hub', 'g2', 'hub', 'drive']]
  ));
  r = await read(ids);
  check('3a  three times faster',    near(r.parts.g2.rpm, motorRpm * 3), true);
  check('3b  a third of the force',  near(r.parts.g2.torque, motorTorque / 3), true);
  check('3c  ratio reads 1:3',       near(r.parts.g2.ratio, 1 / 3), true);

  // ================================================================
  // 4. A three-gear chain multiplies the ratios
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearSmall'], ['g2', 'gearMedium'], ['g3', 'gearSmall']],
    [['mot', 'out', 'g1', 'hub', 'drive'],
     ['g1', 'hub', 'g2', 'hub', 'drive'],
     ['g2', 'hub', 'g3', 'hub', 'drive']]
  ));
  r = await read(ids);
  // 8 -> 16 halves the speed, 16 -> 8 doubles it again: back to 1:1.
  check('4a  middle gear halves it', near(r.parts.g2.rpm, motorRpm / 2), true);
  check('4b  idler restores speed',  near(r.parts.g3.rpm, motorRpm), true);
  check('4c  ends turn the same way',
        Math.sign(r.parts.g3.direction), Math.sign(r.parts.g1.direction));

  // ================================================================
  // 5. Belt between pulleys: sized by radius, same direction
  // ================================================================
  ids = await build(motorRig(
    [['p1', 'pulleySmall'], ['p2', 'pulleyLarge']],
    [['mot', 'out', 'p1', 'hub', 'drive'], ['p1', 'hub', 'p2', 'hub', 'drive']]
  ));
  r = await read(ids);
  // Read the radii from the catalogue rather than hardcoding them, so
  // this stays true if the drawn sizes are ever adjusted.
  const radii = await page.evaluate(() => ({ small: PARTS.pulleySmall.radius, large: PARTS.pulleyLarge.radius }));
  check('5a  belt ratio by radius',
        near(r.parts.p2.rpm, motorRpm * radii.small / radii.large), true);
  check('5b  belt does not reverse',
        Math.sign(r.parts.p2.direction), Math.sign(r.parts.p1.direction));
  check('5c  link known as a belt',  r.parts.p2.linkKind, 'belt');

  // ================================================================
  // 6. Rack: spinning becomes a straight-line push
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearMedium'], ['rk', 'rack']],
    [['mot', 'out', 'g1', 'hub', 'drive'], ['g1', 'hub', 'rk', 'hub', 'drive']]
  ));
  r = await read(ids);
  check('6a  rack moves',            r.parts.rk.linear > 0.1, true);
  check('6b  rack does not spin',    r.parts.rk.rpm, 0);
  // speed = angular speed x the driving gear's pitch radius
  const pitch = await page.evaluate(() => PARTS.gearMedium.teeth * 0.1);
  check('6c  speed matches gear size',
        near(r.parts.rk.linear, (motorRpm / 60) * 2 * Math.PI * pitch), true);
  check('6d  push force = torque / radius',
        near(r.parts.rk.force, motorTorque / pitch), true);

  // ================================================================
  // 7. Wheel: rolls at a speed set by its size
  // ================================================================
  ids = await build(motorRig(
    [['w', 'wheel']], [['mot', 'out', 'w', 'hub', 'drive']]
  ));
  r = await read(ids);
  check('7a  wheel turns with shaft', near(r.parts.w.rpm, motorRpm), true);
  const wheelR = await page.evaluate(() => PARTS.wheel.wheelRadius);
  check('7b  travels at rim speed',
        near(r.parts.w.linear, (motorRpm / 60) * 2 * Math.PI * wheelR), true);

  // ================================================================
  // 8. Lever: a shorter arm gives more force
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearSmall'], ['g2', 'gearLarge'], ['lv', 'lever']],
    [['mot', 'out', 'g1', 'hub', 'drive'],
     ['g1', 'hub', 'g2', 'hub', 'drive'],
     ['g2', 'hub', 'lv', 'hub', 'drive']]
  ));
  await page.evaluate(() => { state.parts.find(p => p.type === 'lever').state.arm = 6; });
  r = await read(ids);
  const forceLong = r.parts.lv.force;
  check('8a  force = torque / arm',  near(forceLong, (motorTorque * 3) / 6), true);
  await page.evaluate(() => { state.parts.find(p => p.type === 'lever').state.arm = 3; });
  r = await read(ids);
  check('8b  half the arm, twice the force', near(r.parts.lv.force, forceLong * 2), true);

  // ================================================================
  // 9. Gears with no motor just sit there
  // ================================================================
  ids = await build({ parts: [['g1', 'gearSmall'], ['g2', 'gearLarge']],
                      links: [['g1', 'hub', 'g2', 'hub', 'drive']] });
  r = await read(ids);
  check('9a  undriven gear is still', r.parts.g2.rpm, 0);
  check('9b  and not marked driven',  r.parts.g2.driven, false);

  // ================================================================
  // 10. The new electrical parts
  // ================================================================
  ids = await build({ parts: [['bat', 'battery'], ['b', 'bulb']],
                      links: [['bat', 'pos', 'b', 'a'], ['b', 'b', 'bat', 'neg']] });
  r = await read(ids);
  check('10a bulb lights',            r.parts.b.brightness > 0.5, true);
  // A bulb has no polarity, so the other way round must work too.
  ids = await build({ parts: [['bat', 'battery'], ['b', 'bulb']],
                      links: [['bat', 'pos', 'b', 'b'], ['b', 'a', 'bat', 'neg']] });
  r = await read(ids);
  check('10b bulb works either way',  r.parts.b.brightness > 0.5, true);

  ids = await build({ parts: [['bat', 'battery'], ['f', 'fan']],
                      links: [['bat', 'pos', 'f', 'a'], ['f', 'b', 'bat', 'neg']] });
  r = await read(ids);
  check('10c fan blows',              r.parts.f.blowing > 0, true);

  // ================================================================
  // 11. Solar panel: power from light, and none in the dark
  // ================================================================
  ids = await build({ parts: [['sol', 'solar'], ['res', 'resistor'], ['led', 'led']],
                      links: [['sol', 'pos', 'res', 'a'], ['res', 'b', 'led', 'anode'],
                              ['led', 'cathode', 'sol', 'neg']] });
  r = await read(ids);
  check('11a full sun lights the LED', r.parts.led.brightness > 0.5, true);
  await page.evaluate(() => { state.parts.find(p => p.type === 'solar').state.sun = 0; });
  r = await read(ids);
  check('11b darkness gives nothing',  r.powered, false);
  await page.evaluate(() => { state.parts.find(p => p.type === 'solar').state.sun = 50; });
  r = await read(ids);
  check('11c half sun, dimmer light',
        r.parts.led.brightness > 0.1 && r.parts.led.brightness < 0.75, true);

  // Only one power source at a time.
  const before = await page.evaluate(() => state.parts.length);
  await page.evaluate(() => addPart('battery'));
  check('11d second source refused',
        await page.evaluate(() => state.parts.length), before);

  // ================================================================
  // 12. Capacitor: charges up, then powers the light on its own
  // ================================================================
  ids = await build({
    parts: [['bat', 'battery'], ['sw', 'switch'], ['cap', 'capacitor'],
            ['res', 'resistor'], ['led', 'led']],
    links: [['bat', 'pos', 'sw', 'a'],
            ['sw', 'b', 'cap', 'anode'],
            ['sw', 'b', 'res', 'a'],
            ['cap', 'cathode', 'bat', 'neg'],
            ['res', 'b', 'led', 'anode'],
            ['led', 'cathode', 'bat', 'neg']]
  });
  r = await read(ids);
  check('12a starts empty',           (r.parts.cap.charge || 0) < 0.1, true);

  // Close the switch and let the real animation loop run.
  await page.evaluate(() => { state.parts.find(p => p.type === 'switch').state.closed = true; });
  await page.waitForTimeout(500);
  r = await read(ids);
  check('12b charges up',             r.parts.cap.charge > 5, true);
  check('12c LED lit from battery',   r.parts.led.brightness > 0.5, true);
  check('12d not on the capacitor yet', r.runningOnCapacitor, false);

  // Open the switch: the battery is cut off, so the capacitor takes over.
  await page.evaluate(() => { state.parts.find(p => p.type === 'switch').state.closed = false; });
  await page.waitForTimeout(120);
  r = await read(ids);
  check('12e now running on the capacitor', r.runningOnCapacitor, true);
  check('12f LED still lit',          r.parts.led.brightness > 0.05, true);
  const heldCharge = r.parts.cap.charge;

  // And it should fade, not stay on forever.
  await page.waitForTimeout(1400);
  r = await read(ids);
  check('12g charge drains away',     r.parts.cap.charge < heldCharge, true);

  // ================================================================
  // 13. Wires and shafts must not mix
  // ================================================================
  ids = await build({ parts: [['bat', 'battery'], ['g1', 'gearSmall']], links: [] });
  const mixed = await page.evaluate(map => {
    const before = state.wires.length;
    onNodeClick(map.bat, 'pos');       // arm an electrical leg
    onNodeClick(map.g1, 'hub');        // then tap a mechanical shaft
    return { made: state.wires.length - before, armed: !!state.armedLeg };
  }, ids);
  check('13a leg-to-shaft refused',   mixed.made, 0);
  check('13b and the attempt cleared', mixed.armed, false);

  const shaftLink = await page.evaluate(map => {
    const before = state.wires.length;
    onNodeClick(map.g1, 'hub');
    const g2 = state.parts.find(p => p.type === 'gearSmall' && p.id !== map.g1);
    return state.wires.length - before;
  }, ids);
  check('13c lone shaft tap makes nothing', shaftLink, 0);

  // ================================================================
  // 14. The new challenges actually unlock
  // ================================================================
  ids = await build(motorRig(
    [['g1', 'gearSmall'], ['g2', 'gearLarge'], ['w', 'wheel']],
    [['mot', 'out', 'g1', 'hub', 'drive'],
     ['g1', 'hub', 'g2', 'hub', 'drive'],
     ['g2', 'hub', 'w', 'hub', 'drive']]
  ));
  await page.waitForTimeout(350);
  const done = await page.evaluate(() => [...state.completed]);
  check('14a "get it turning" won',   done.includes('get-turning'), true);
  check('14b "gear down" won',        done.includes('gear-down'), true);
  check('14c "get rolling" won',      done.includes('roll-on'), true);
  check('14d "gear up" not yet',      done.includes('gear-up'), false);

  check('14e all 18 challenges listed',
        await page.evaluate(() => CHALLENGES.length), 18);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors.');
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
