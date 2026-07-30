/* ============================================================
   tests/touch.test.js
   ------------------------------------------------------------
   Checks that SparkLab is actually usable with a finger on an
   iPad, rather than only with a mouse. Touch screens have no
   hover, fingers are far less precise than a cursor, and a tap
   wobbles — all three break things that work fine on a desktop.

       npm test

   Run alongside circuit.test.js by the same command.
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

// Apple's Human Interface Guidelines: nothing tappable below 44pt.
const MIN_TAP_TARGET = 44;

(async () => {
  const { server, port } = await serve();
  const browser = await chromium.launch();

  // An iPad Air in landscape, with a real touch screen and no mouse.
  const context = await browser.newContext({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.tap('#helpClose');

  const add = n => page.tap(`.palette-item:has(.palette-name:text-is("${n}"))`).then(() => page.waitForTimeout(90));

  // === 1. The app knows it is being used by a finger ===
  check('1a  detects coarse pointer',
    await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), true);
  check('1b  drag threshold relaxed',
    await page.evaluate(() => DRAG_THRESHOLD), 12);

  await add('Battery'); await add('LED'); await add('Resistor'); await add('Switch');

  // === 2. Delete buttons are visible without hovering ===
  // A touch screen cannot hover, so a hover-only control is unreachable.
  check('2a  delete button visible',
    await page.evaluate(() => getComputedStyle(document.querySelector('.part-del')).opacity), '1');
  const delBox = await page.locator('.part-del').first().boundingBox();
  check('2b  delete button >= 28px', delBox.width >= 28 && delBox.height >= 28, true);

  // === 3. Legs are big enough to hit with a fingertip ===
  // The visible dot stays small, but the area that responds must not.
  const tapArea = await page.evaluate(() => {
    const dot = document.querySelector('.leg-dot');
    const r = dot.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Walk outwards until the point stops belonging to this leg.
    let reach = 0;
    for (let d = 1; d < 60; d++) {
      const hit = document.elementFromPoint(cx + d, cy);
      if (hit !== dot && !dot.contains(hit)) break;
      reach = d;
    }
    return reach * 2;   // full width of the responsive area
  });
  check(`3a  leg tap area >= ${MIN_TAP_TARGET}px`, tapArea >= MIN_TAP_TARGET, true);

  // === 4. Tap-to-connect shows the floating prompt ===
  const pillHidden = () => page.evaluate(() => document.getElementById('connectPill').classList.contains('hidden'));
  check('4a  prompt hidden at rest', await pillHidden(), true);

  await page.tap('.part-battery .leg-dot[data-leg="pos"]');
  await page.waitForTimeout(120);
  check('4b  prompt appears on first tap', await pillHidden(), false);
  check('4c  armed leg is highlighted',
    await page.locator('.leg-dot.armed').count(), 1);

  // === 5. The prompt must never block a tap meant for a part ===
  // It floats over the bench, so if it swallowed taps it would make
  // the iPad worse, not better.
  const pillBlocks = await page.evaluate(() => {
    const pill = document.getElementById('connectPill');
    const r = pill.getBoundingClientRect();
    const under = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
    return pill.contains(under);
  });
  check('5a  prompt is click-through', pillBlocks, false);

  // === 6. Finishing the wire with a second tap ===
  await page.tap('.part-led .leg-dot[data-leg="anode"]');
  await page.waitForTimeout(120);
  check('6a  wire created', await page.evaluate(() => state.wires.length), 1);
  check('6b  prompt disappears', await pillHidden(), true);

  // === 7. Cancel button on the prompt ===
  await page.tap('.part-led .leg-dot[data-leg="cathode"]');
  await page.waitForTimeout(120);
  await page.tap('#connectCancel');
  await page.waitForTimeout(120);
  check('7a  cancel clears the prompt', await pillHidden(), true);
  check('7b  no stray wire made', await page.evaluate(() => state.wires.length), 1);

  // === 8. A wobbly tap still toggles a switch ===
  // A finger never lands perfectly still. Anything under the drag
  // threshold must count as a tap, not as a drag.
  const before = await page.evaluate(() => state.parts.find(p => p.type === 'switch').state.closed);
  const sw = await page.locator('.part-switch .part-art').boundingBox();
  await page.evaluate(([x, y]) => {
    const node = document.querySelector('.part-switch');
    const opts = p => ({ pointerId: 1, bubbles: true, clientX: p[0], clientY: p[1], pointerType: 'touch' });
    node.dispatchEvent(new PointerEvent('pointerdown', opts([x, y])));
    node.dispatchEvent(new PointerEvent('pointermove', opts([x + 7, y + 4])));  // wobble
    node.dispatchEvent(new PointerEvent('pointerup',   opts([x + 7, y + 4])));
  }, [sw.x + sw.width / 2, sw.y + sw.height / 2]);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => state.parts.find(p => p.type === 'switch').state.closed);
  check('8a  wobbly tap toggles switch', after !== before, true);

  // === 9. A deliberate drag still moves the part ===
  const startX = await page.evaluate(() => state.parts.find(p => p.type === 'switch').x);
  await page.evaluate(([x, y]) => {
    const node = document.querySelector('.part-switch');
    const opts = p => ({ pointerId: 2, bubbles: true, clientX: p[0], clientY: p[1], pointerType: 'touch' });
    node.dispatchEvent(new PointerEvent('pointerdown', opts([x, y])));
    node.dispatchEvent(new PointerEvent('pointermove', opts([x + 90, y + 60])));
    node.dispatchEvent(new PointerEvent('pointerup',   opts([x + 90, y + 60])));
  }, [sw.x + sw.width / 2, sw.y + sw.height / 2]);
  await page.waitForTimeout(150);
  const movedX = await page.evaluate(() => state.parts.find(p => p.type === 'switch').x);
  check('9a  real drag moves the part', movedX - startX > 60, true);

  // === 10. Parts cannot be dragged off the edge, losing their delete button ===
  await page.evaluate(() => {
    const p = state.parts.find(x => x.type === 'switch');
    p.x = -500; p.y = -500;
  });
  await page.evaluate(([x, y]) => {
    const node = document.querySelector('.part-switch');
    const opts = p => ({ pointerId: 3, bubbles: true, clientX: p[0], clientY: p[1], pointerType: 'touch' });
    node.dispatchEvent(new PointerEvent('pointerdown', opts([x, y])));
    node.dispatchEvent(new PointerEvent('pointermove', opts([x - 400, y - 400])));
    node.dispatchEvent(new PointerEvent('pointerup',   opts([x - 400, y - 400])));
  }, [sw.x + sw.width / 2, sw.y + sw.height / 2]);
  const pos = await page.evaluate(() => {
    const p = state.parts.find(x => x.type === 'switch');
    return { x: p.x, y: p.y };
  });
  check('10a stays on the bench', pos.x >= 16 && pos.y >= 16, true);

  // === 11. Tapping a wire deletes it, with a finger-sized hit area ===
  const strokeW = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.wire-hit')).strokeWidth));
  check('11a wire hit area >= 30px', strokeW >= 30, true);
  const pt = await page.evaluate(() => {
    const path = document.querySelector('.wire-hit');
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const box = document.getElementById('bench').getBoundingClientRect();
    return { x: box.left + p.x, y: box.top + p.y };
  });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForTimeout(150);
  check('11b tapping a wire deletes it', await page.evaluate(() => state.wires.length), 0);

  // === 12. Nothing overflows sideways on an iPad ===
  check('12a no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  check('12b bench is usably wide',
    await page.evaluate(() => document.getElementById('bench').clientWidth > 450), true);

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors.');
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
