# ⚡ SparkLab

A virtual electronics and mechanics workbench that runs in a web browser. Drag out a
battery, an LED, a resistor and a switch, wire them together, and watch the circuit come
alive — then bolt gears onto the motor and watch electricity turn into movement. All so
you can learn how this stuff actually works before spending money on a real kit.

Eighteen built-in challenges take you from "light a single LED" to building a gear train,
and they tick themselves off automatically as soon as your build works.

---

## Try it

**On your own computer:** find `index.html` and double-click it. That's it — it opens in
your browser and works immediately. There is nothing to install and nothing to run.

**On the internet:** see [Putting it online](#putting-it-online) below.

---

## What's in the box

**Electrical**

| Part | What it teaches |
|---|---|
| **Battery** | Every circuit needs a power source, and current must return to it |
| **Solar panel** | Electricity can come from light. Slide the sun up and down |
| **LED** | Polarity — it only works one way round |
| **Light bulb** | A filament lamp, which works either way round |
| **Resistor** | Why you can't wire an LED straight to a battery. Tap it to change its value |
| **Switch** | Opening a circuit stops everything |
| **Push button** | Momentary contact — connected only while held |
| **Dial** | More resistance means less current means a dimmer light |
| **Capacitor** | Storing electricity, then giving it back after the power is cut |
| **Buzzer** | Current can do more than make light (turn your sound on) |
| **Fan** | Current makes a draught |
| **Motor** | Current becomes movement — and its shaft drives the mechanical parts |

**Mechanical**

| Part | What it teaches |
|---|---|
| **Gears** (small, medium, large) | Gear ratios: trading speed for turning force |
| **Pulleys** (small, large) | Belt drive — sending turning across a gap, without reversing it |
| **Rack** | Turning a rotation into a straight-line push |
| **Wheel** | How fast a rolling wheel actually travels |
| **Lever** | A long arm moves further; a short arm pushes harder |

Your build and your progress are saved in your own browser, so you can close the tab and
come back to it later.

### Two kinds of connection

Parts have **round** connection points and **square** ones, and they never join to each
other — you cannot solder a wire onto a spinning axle.

- **Round points are legs.** Joining two of them runs a wire, which carries electricity.
- **Square points are shafts.** Joining two of them makes a drive link, which carries
  turning. The motor has one on top; every mechanical part has one.

The bar along the bottom of the screen is where the numbers appear: what is lit or
turning, any warnings, and — once you build a gear chain — the gear ratio along with the
speed and turning force at the end of it.

### On an iPad

SparkLab is built for touch as well as mouse, and on a tablet the layout changes to suit it.

**The bench gets the whole screen.** The Parts and Challenges panels become sheets that
slide in over the bench when you tap their buttons, then get out of the way again. On the
desktop they stay pinned open as columns. This matters more than it sounds: as fixed
columns they took over half an iPad's display, leaving room for barely three parts.

**You don't have to hit the legs exactly.** Tap a leg to start a wire and a floating prompt
appears. To finish it, tap anywhere on the part you want to reach — SparkLab joins to
whichever of its legs is nearest. Tapping the part you started from cancels instead.

**Everything else is sized for a finger.** Legs carry a 48-pixel invisible tap area around
their small visible dot and grow while a wire is half-drawn, delete buttons are always
shown rather than waiting for a hover that a finger can never do, and a tap may wobble by
12 pixels before it counts as a drag, so switches toggle reliably.

---

## How the code is put together

Five files. No frameworks, no build step, no server — the whole thing is plain HTML, CSS
and JavaScript, which is why it can be published for free and will still work in ten years.

```
index.html          the page: a top bar, three panels, and a hidden help pop-up
css/style.css       how everything looks. All colours are set once at the top
js/parts.js         the parts catalogue: size, connection points and drawing for each part
js/circuit.js       the electrical simulation — works out where current flows
js/mechanics.js     the mechanical simulation — works out what turns, and how fast
js/challenges.js    the eighteen lessons and the rules that mark them complete
js/app.js           the glue: tapping, dragging, wiring, and drawing the screen
```

**Read them in that order** if you want to understand the project. `js/circuit.js` is the
interesting one and it is heavily commented.

### How the simulation works

It comes down to three steps, and you can follow all three in `js/circuit.js`:

1. **Group the legs.** Any legs joined by wires are electrically the same point. Those
   groups are called *nets*.
2. **Find the loops.** Starting at the battery's `+`, walk every possible route through
   the parts until you arrive back at the battery's `−`. Each complete route is a loop.
3. **Apply Ohm's law.** Add up the resistance around a loop, then
   `current = voltage ÷ resistance`. That number decides how brightly an LED glows, how
   fast a motor spins, and whether you get an overload warning.

An LED wired backwards refuses to conduct, an open switch is treated as an infinite
resistance, and a loop with almost no resistance is reported as a short circuit. A
capacitor pushes back against the source as it fills, which is why the current into it
tails off, and when the source is cut off it becomes a source itself until it runs flat.

### How the gears work

Turning does not flow in loops, so `js/mechanics.js` searches differently: it starts at
the motor and spreads outwards along the drive links, like a family tree.

The one rule that matters is that **gearing is a trade, never a gain**. Every link that
slows things down multiplies the turning force by exactly the same amount:

| Link | Speed | Turning force |
|---|---|---|
| Gear meshes with gear | ÷ tooth ratio | × tooth ratio |
| Belt between pulleys | ÷ radius ratio | × radius ratio |
| Mounted on the same shaft | unchanged | unchanged |

So an 8-tooth gear driving a 24-tooth one turns 3 times slower with 3 times the force —
and the two meshed gears turn in opposite directions, while a belt keeps them the same
way round. A rack converts the rim speed of the gear driving it into a straight-line
speed, and a lever divides its turning force by the length of its arm.

The tests check this directly: speed multiplied by force has to come out the same at the
end of a gear chain as it was at the motor. If it ever did not, the app would be teaching
that you can get something for nothing.

### Where it is deliberately simplified

This is a teaching tool, not an engineering simulator, and it's worth being honest about
the difference:

- Each loop is solved on its own. Real parallel circuits share current between branches in
  a way SparkLab does not model, so readings in a branching circuit are approximate.
- An LED is treated as a plain resistance. Real LEDs have a forward voltage of about 2 V
  and a much sharper current curve.
- Nothing is ever permanently destroyed. Overload the LED and you get a warning and a
  flashing bulb — in real life you would be buying a new one.
- The battery never goes flat and has no internal resistance.
- Nothing mechanical has any weight, friction or springiness, so gears never slow the
  motor down, never slip, and reach their speed instantly. In reality a heavy load would
  drag a motor's speed down, which is half the reason you gear things down at all.
- Only one power source can be on the bench at a time, so a battery and a solar panel
  cannot be combined.

---

## Putting it online

The site is free to host on GitHub Pages because it is just files — no server needed.

1. Get this code onto the `main` branch of your GitHub repository.
   (If it is currently on another branch, open a pull request and merge it.)
2. On GitHub, go to your repository and click **Settings**.
3. In the left-hand menu, click **Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Set the branch to **main** and the folder to **/ (root)**, then click **Save**.
6. Wait a minute or two, then reload the page. GitHub will show you the address.

Your site will be at:

```
https://sashatarasov137-svg.github.io/technology-game/
```

Every time you push a change to `main`, GitHub republishes the site automatically within
a minute. There is nothing to redeploy by hand.

### Using your own domain name

If you later buy a domain, add it under the same **Settings → Pages** screen in the
**Custom domain** box, then point the domain's DNS at GitHub. GitHub gives you an HTTPS
certificate for free.

---

## Changing things

**Add a new part** — open `js/parts.js`, copy an existing entry, and give it a name,
a resistance and a drawing. Then add its key to the right group in `PALETTE_GROUPS` at
the bottom of the file. It will appear in the drawer and work in the simulation straight
away. Give it `legs` if it carries electricity and `shafts` if it carries turning.

**Add a new challenge** — open `js/challenges.js` and add an entry to the `CHALLENGES`
list with a `title`, a `brief`, a `hint`, and a `check` function that returns `true` when
the goal is met.

**Change the colours** — everything lives in the `:root` block at the top of
`css/style.css`. Change one value there and it updates across the whole app.

---

## Running the tests

Optional, and not needed to use or publish the site. If you change the code and want to
check you haven't broken the electronics:

```bash
npm install
npm test
```

This opens a real browser and runs 116 checks across three suites:

- **`tests/circuit.test.js`** — 38 checks on the electronics: that Ohm's law gives the
  right current, that a backwards LED stays dark, that a short circuit is caught, that
  the first eight challenges unlock correctly, and that your work survives a reload.
- **`tests/mechanics.test.js`** — 50 checks on the gears and the newer electrical parts:
  that gear ratios come out exactly right in both directions, that meshed gears reverse
  while belts do not, that speed times force is conserved through a chain, that a lever
  with half the arm gives twice the force, that a solar panel gives nothing in the dark,
  and that a capacitor charges up and then runs the light on its own.
- **`tests/touch.test.js`** — 28 checks on an emulated iPad: that the bench really does
  fill the screen, that the sheets open and close, that tap targets meet Apple's 44-pixel
  minimum, that delete buttons appear without a hover, that the connect prompt never
  swallows a tap meant for a part underneath it, that tapping a part's body finishes a
  wire to its nearest leg, and that a wobbly tap toggles a switch while a real drag still
  moves it.
