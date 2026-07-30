# ⚡ SparkLab

A virtual electronics workbench that runs in a web browser. Drag out a battery, an LED,
a resistor and a switch, wire them together, and watch the circuit come alive — so you
can learn how electronics actually work before spending money on a real kit.

Eight built-in challenges take you from "light a single LED" to running a motor, and they
tick themselves off automatically as soon as your circuit works.

---

## Try it

**On your own computer:** find `index.html` and double-click it. That's it — it opens in
your browser and works immediately. There is nothing to install and nothing to run.

**On the internet:** see [Putting it online](#putting-it-online) below.

---

## What's in the box

| Part | What it teaches |
|---|---|
| **Battery** | Every circuit needs a power source, and current must return to it |
| **LED** | Polarity — it only works one way round |
| **Resistor** | Why you can't wire an LED straight to a battery. Click it to change its value |
| **Switch** | Opening a circuit stops everything |
| **Push button** | Momentary contact — connected only while held |
| **Dial** | More resistance means less current means a dimmer light |
| **Buzzer** | Current can do more than make light (turn your sound on) |
| **Motor** | Current can do work, and more current means more speed |

Your circuit and your progress are saved in your own browser, so you can close the tab
and come back to it later.

---

## How the code is put together

Five files. No frameworks, no build step, no server — the whole thing is plain HTML, CSS
and JavaScript, which is why it can be published for free and will still work in ten years.

```
index.html          the page: a top bar, three columns, and a hidden help pop-up
css/style.css       how everything looks. All colours are set once at the top
js/parts.js         the parts catalogue: size, legs, resistance and drawing for each part
js/circuit.js       the simulation — works out where electricity flows
js/challenges.js    the eight lessons and the rules that mark them complete
js/app.js           the glue: clicking, dragging, wiring, and drawing the screen
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
resistance, and a loop with almost no resistance is reported as a short circuit.

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
a resistance and a drawing. Then add its key to `PALETTE_ORDER` at the bottom of the file.
It will appear in the drawer and work in the simulation straight away.

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

This opens a real browser, builds circuits, and checks 38 things — that Ohm's law gives
the right current, that a backwards LED stays dark, that a short circuit is caught, that
each challenge unlocks correctly, and that your work survives a page reload.
