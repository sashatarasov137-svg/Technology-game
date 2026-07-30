/* ============================================================
   tests/library.test.js
   ------------------------------------------------------------
   Covers the four newest features: the buggy, the ready-made
   example circuits, the broken-circuit puzzles, and the "what's
   inside" explanations.

   The two checks that matter most are on the puzzles. Every one
   has to actually be broken when it opens — a puzzle that works
   straight away teaches nothing — and every one has to actually
   be fixable, so nobody is ever stuck on an impossible task.

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

  const run = () => page.evaluate(() => {
    const sim = simulate(state.parts, state.wires, 0.016);
    simulateMechanics(state.parts, state.wires, sim);
    return sim;
  });

  // ================================================================
  // 1. Every part explains itself
  // ================================================================
  const lessons = await page.evaluate(() => Object.entries(PARTS).map(([k, p]) => ({
    key: k, name: p.name, len: (p.lesson || '').length
  })));
  check('1a  every part has a lesson', lessons.every(l => l.len > 0), true);
  check('1b  none are token-length',   lessons.every(l => l.len > 200), true);
  check('1c  covers all 21 parts',     lessons.length, 21);

  // The ? on a palette card opens it, and does not add the part.
  await page.click('.palette-item:has(.palette-name:text-is("LED")) .palette-info');
  await page.waitForTimeout(200);
  check('1d  explanation opens',
    await page.evaluate(() => !document.getElementById('lessonModal').classList.contains('hidden')), true);
  check('1e  it is the right part',
    await page.textContent('#lessonTitle'), 'LED');
  check('1f  body has real content',
    (await page.textContent('#lessonBody')).length > 200, true);
  check('1g  no part was added',
    await page.evaluate(() => state.parts.length), 0);
  await page.click('#lessonClose');
  await page.waitForTimeout(150);

  // ================================================================
  // 2. The buggy: gearing decides whether it climbs
  // ================================================================
  const buggyRig = (gearA, gearB, hill) => page.evaluate(cfg => {
    clearBench();
    const ids = {};
    for (const [name, type] of [['bat', 'battery'], ['mot', 'motor'],
                                ['g1', cfg.a], ['g2', cfg.b], ['bug', 'buggy']]) {
      addPart(type);
      ids[name] = state.parts[state.parts.length - 1].id;
    }
    state.parts.find(p => p.id === ids.bug).state.hill = cfg.hill;
    const w = (a, an, b, bn, k) => state.wires.push({
      id: 'w' + (state.nextId++), kind: k || 'wire',
      from: { partId: ids[a], legId: an }, to: { partId: ids[b], legId: bn }
    });
    w('bat', 'pos', 'mot', 'a'); w('mot', 'b', 'bat', 'neg');
    w('mot', 'out', 'g1', 'hub', 'drive');
    w('g1', 'hub', 'g2', 'hub', 'drive');
    w('g2', 'hub', 'bug', 'hub', 'drive');
    rebuildBench();
    return ids.bug;
  }, { a: gearA, b: gearB, hill });

  const buggyState = async id => (await run()).partState[id];

  // Geared down 3:1 — slow but strong.
  let bug = await buggyRig('gearSmall', 'gearLarge', false);
  let bs = await buggyState(bug);
  check('2a  geared down, moves on flat', bs.stalled, false);
  const slowSpeed = bs.linear;

  bug = await buggyRig('gearSmall', 'gearLarge', true);
  bs = await buggyState(bug);
  check('2b  geared down, climbs the hill', bs.stalled, false);
  check('2c  it knows it is on a hill', bs.onHill, true);
  check('2d  and needs more force there', bs.needed > 1, true);

  // Geared up 1:3 — fast but feeble.
  bug = await buggyRig('gearLarge', 'gearSmall', false);
  bs = await buggyState(bug);
  check('2e  geared up, still moves on flat', bs.stalled, false);
  const fastSpeed = bs.linear;
  check('2f  and is much faster', fastSpeed > slowSpeed * 2, true);

  bug = await buggyRig('gearLarge', 'gearSmall', true);
  bs = await buggyState(bug);
  check('2g  geared up, stalls on the hill', bs.stalled, true);
  check('2h  stalled means stopped', bs.linear, 0);
  check('2i  push is short of what is needed', bs.push < bs.needed, true);

  // The trade is the whole lesson: neither setting wins at both.
  check('2j  no gearing is best at both', slowSpeed < fastSpeed, true);

  // Tapping the buggy raises and lowers the hill.
  await buggyRig('gearSmall', 'gearLarge', false);
  await page.click('.part-buggy .part-art');
  await page.waitForTimeout(200);
  check('2k  tapping raises the hill',
    await page.evaluate(() => state.parts.find(p => p.type === 'buggy').state.hill), true);

  // ================================================================
  // 3. The ready-made circuits all work
  // ================================================================
  const openExample = id => page.evaluate(exId => {
    clearBench();
    loadBuild(EXAMPLES.find(e => e.id === exId).build);
  }, id);

  const count = await page.evaluate(() => EXAMPLES.length);
  check('3a  six examples', count, 6);

  await openExample('torch');
  await page.waitForTimeout(120);
  let sim = await run();
  check('3b  torch lights up', await page.evaluate(s =>
    state.parts.some(p => p.type === 'led' && s.partState[p.id].brightness > 0.5), sim), true);
  check('3c  torch is not overloaded', await page.evaluate(s =>
    !Object.values(s.partState).some(x => x.overloaded), sim), true);

  await openExample('doorbell');
  await page.waitForTimeout(120);
  sim = await run();
  check('3d  doorbell silent until pressed', await page.evaluate(s =>
    state.parts.some(p => p.type === 'buzzer' && s.partState[p.id].sounding), sim), false);

  await openExample('dimmer');
  await page.waitForTimeout(120);
  sim = await run();
  check('3e  dimmer lamp is lit', await page.evaluate(s =>
    state.parts.some(p => p.type === 'bulb' && s.partState[p.id].brightness > 0.5), sim), true);

  await openExample('solar-light');
  await page.waitForTimeout(120);
  sim = await run();
  check('3f  solar light runs with no battery', await page.evaluate(s =>
    !state.parts.some(p => p.type === 'battery')
    && state.parts.some(p => p.type === 'led' && s.partState[p.id].brightness > 0.5), sim), true);

  await openExample('geared-buggy');
  await page.waitForTimeout(200);
  sim = await run();
  check('3g  geared buggy drives', await page.evaluate(s =>
    state.parts.some(p => p.type === 'buggy' && !s.partState[p.id].stalled
                          && s.partState[p.id].linear > 0), sim), true);

  await openExample('afterglow');
  await page.waitForTimeout(600);        // let the capacitor fill
  sim = await run();
  check('3h  afterglow charges its capacitor', await page.evaluate(s =>
    state.parts.some(p => p.type === 'capacitor' && s.partState[p.id].charge > 4), sim), true);

  // ================================================================
  // 4. Every puzzle is genuinely broken when it opens
  // ================================================================
  const puzzleIds = await page.evaluate(() => PUZZLES.map(p => p.id));
  check('4a  six puzzles', puzzleIds.length, 6);

  for (const id of puzzleIds) {
    await page.evaluate(pid => {
      clearBench();
      loadBuild(PUZZLES.find(p => p.id === pid).build);
    }, id);
    await page.waitForTimeout(200);
    const solvedOnLoad = await page.evaluate(pid => {
      const sim = simulate(state.parts, state.wires, 0.016);
      simulateMechanics(state.parts, state.wires, sim);
      return !!PUZZLES.find(p => p.id === pid).check(state.parts, sim);
    }, id);
    check(`4b  "${id}" starts broken`, solvedOnLoad, false);
  }

  // ================================================================
  // 5. And every puzzle can actually be fixed
  // ================================================================
  const fixes = {
    // Put the LED round the right way.
    backwards: () => page.evaluate(() => {
      state.wires.forEach(w => [w.from, w.to].forEach(e => {
        const p = state.parts.find(x => x.id === e.partId);
        if (p && p.type === 'led') e.legId = e.legId === 'anode' ? 'cathode' : 'anode';
      }));
    }),
    // Add the missing wire home.
    'no-return': () => page.evaluate(() => {
      const led = state.parts.find(p => p.type === 'led');
      const bat = state.parts.find(p => p.type === 'battery');
      state.wires.push({ id: 'fix', kind: 'wire',
        from: { partId: led.id, legId: 'cathode' }, to: { partId: bat.id, legId: 'neg' } });
    }),
    // Wind the resistor down to a sensible value.
    'too-dim': () => page.evaluate(() => {
      const r = state.parts.find(p => p.type === 'resistor');
      r.state.resistance = 470; r.state.valueIndex = 1;
    }),
    // Put the spare resistor into the loop.
    'no-resistor': () => page.evaluate(() => {
      const led = state.parts.find(p => p.type === 'led');
      const bat = state.parts.find(p => p.type === 'battery');
      const res = state.parts.find(p => p.type === 'resistor');
      state.wires = state.wires.filter(w =>
        !(w.from.partId === bat.id && w.from.legId === 'pos'));
      state.wires.push(
        { id: 'f1', kind: 'wire', from: { partId: bat.id, legId: 'pos' }, to: { partId: res.id, legId: 'a' } },
        { id: 'f2', kind: 'wire', from: { partId: res.id, legId: 'b' }, to: { partId: led.id, legId: 'anode' } });
    }),
    // Link the motor's shaft to the gears.
    'no-drive': () => page.evaluate(() => {
      const mot = state.parts.find(p => p.type === 'motor');
      const g1  = state.parts.find(p => p.type === 'gearSmall');
      state.wires.push({ id: 'fix', kind: 'drive',
        from: { partId: mot.id, legId: 'out' }, to: { partId: g1.id, legId: 'hub' } });
    }),
    // Turn the gear train around so it gears down instead of up.
    'wont-climb': () => page.evaluate(() => {
      const mot = state.parts.find(p => p.type === 'motor');
      const big = state.parts.find(p => p.type === 'gearLarge');
      const sml = state.parts.find(p => p.type === 'gearSmall');
      const bug = state.parts.find(p => p.type === 'buggy');
      state.wires = state.wires.filter(w => w.kind !== 'drive');
      state.wires.push(
        { id: 'f1', kind: 'drive', from: { partId: mot.id, legId: 'out' }, to: { partId: sml.id, legId: 'hub' } },
        { id: 'f2', kind: 'drive', from: { partId: sml.id, legId: 'hub' }, to: { partId: big.id, legId: 'hub' } },
        { id: 'f3', kind: 'drive', from: { partId: big.id, legId: 'hub' }, to: { partId: bug.id, legId: 'hub' } });
    })
  };

  for (const id of puzzleIds) {
    await page.evaluate(pid => {
      clearBench();
      state.puzzle = pid;
      loadBuild(PUZZLES.find(p => p.id === pid).build);
    }, id);
    await page.waitForTimeout(150);
    await fixes[id]();
    await page.evaluate(() => rebuildBench());
    await page.waitForTimeout(300);
    const nowSolved = await page.evaluate(pid => {
      const sim = simulate(state.parts, state.wires, 0.016);
      simulateMechanics(state.parts, state.wires, sim);
      return !!PUZZLES.find(p => p.id === pid).check(state.parts, sim);
    }, id);
    check(`5a  "${id}" can be fixed`, nowSolved, true);
  }

  // Fixing one should record it and show the explanation.
  check('5b  solving is remembered',
    await page.evaluate(() => state.solved.size > 0), true);
  check('5c  the answer is shown',
    await page.evaluate(() => !document.getElementById('lessonModal').classList.contains('hidden')), true);
  check('5d  every puzzle has an answer written',
    await page.evaluate(() => PUZZLES.every(p => (p.answer || '').length > 100)), true);

  // ================================================================
  // 6. Opening a build over existing work asks first
  // ================================================================
  await page.click('#lessonClose');
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.click('#helpClose');
  await page.evaluate(() => addPart('battery'));
  await page.waitForTimeout(120);
  await page.evaluate(() => openExample(EXAMPLES[0]));
  await page.waitForTimeout(200);
  check('6a  asks before wiping the bench',
    await page.evaluate(() => !document.getElementById('confirmModal').classList.contains('hidden')), true);
  await page.click('#confirmCancel');
  await page.waitForTimeout(150);
  check('6b  "keep mine" leaves it alone',
    await page.evaluate(() => state.parts.length), 1);
  await page.evaluate(() => openExample(EXAMPLES[0]));
  await page.waitForTimeout(150);
  await page.click('#confirmOk');
  await page.waitForTimeout(250);
  check('6c  "open it" loads the build',
    await page.evaluate(() => state.parts.length), 4);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors.');
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
