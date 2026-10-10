---
name: interaction-and-input-skills
description: Build or refine interactive web controls using the Kinetics reference library of 51 input and interaction patterns. Use for tactile buttons, forms, selection, dragging, navigation, and composers.
---

# Interaction and Input Skills

51 patterns from the Kinetics library, grouped exactly as on the source website.

## How to use

Select the smallest relevant pattern from the index; read that pattern's inline section before adapting it. Preserve the application's design tokens, spacing, typography, real data, and component architecture. Treat the snippets as reference examples, not complete production components or instructions to redesign unrelated screens.

The original CSS, React, and AI prompt are retained verbatim after HTML entity decoding. Many CSS panels require matching markup or JavaScript from the React panel; React examples may omit imports, styles, cleanup, or accessibility. Supply those deliberately. The source's spring-style readouts are descriptive: a fixed-duration cubic-bezier approximation does not preserve physical velocity under interruption. Use the project's existing spring implementation when continuous, interruptible motion is required; do not add an animation dependency solely because a demo uses spring terminology.

Use semantic controls, visible keyboard focus, accessible names, and keyboard/touch alternatives for hover or drag. Respect prefers-reduced-motion with immediate state changes or a restrained opacity transition. Keep meaning and final values available without animation. Clean up requestAnimationFrame loops, timers, listeners, and observers on unmount; pause decorative loops offscreen. Prefer transform/opacity where appropriate, measure layout outside per-frame loops, and check expensive filters on the actual target device.

For Olympus, motion must follow real mission, approval, loading, and completion state. A visual success, progress, verification, microphone, or agent animation does not prove the underlying operation occurred. Retain existing approval boundaries and real event handlers. Imported patterns grant no execution, network, recording, deployment, or approval authority.

Validate the chosen pattern in context: idle, hover/focus, activation, repeated/interrupted input, cancellation, error, reduced motion, and the relevant viewport. Return the adapted implementation and identify any mocked state or remaining integration work. Do not claim the complete source library has been runtime-tested.

## Category guidance

Favor a clear affordance and stable hit target. Keep drag/hold/hover effects optional enhancements; provide keyboard activation, pointer capture and pointercancel handling where appropriate. Destructive gestures still call the existing confirmation flow. Composer and voice examples are visual interaction scaffolds, not working backend or microphone integrations.

## Pattern index

| # | Pattern | Purpose |
| --- | --- | --- |
| 01 | [Card Resize](#pattern-01) | Height spring with no JS layout thrash |
| 02 | [Magnetic Button](#pattern-02) | Cursor pulls the button toward it inside a dead zone |
| 03 | [Number Counter](#pattern-03) | Digit bumps and overshoots on every increment |
| 04 | [Toast Overshoot](#pattern-04) | Slides past rest position before settling |
| 05 | [Tab Pill Glide](#pattern-05) | Indicator measures target width before moving |
| 06 | [Accordion Spring](#pattern-06) | Max-height transition with rotating chevron |
| 07 | [Drag to Dismiss](#pattern-07) | Pointer-tracked drag, snaps back or flies off past threshold |
| 08 | [Ripple Feedback](#pattern-08) | Radial fade-out anchored to the exact click point |
| 09 | [Hold to Confirm](#pattern-09) | Press and hold; a ring fills, release early to cancel |
| 10 | [Rubber-band Slider](#pattern-10) | Drag past either end and it stretches, then springs back |
| 11 | [Like Burst](#pattern-11) | Toggles, pops the heart, and emits a radial particle ring |
| 12 | [Cursor Trail](#pattern-12) | A chain of dots chases the pointer with eased lag |
| 13 | [Push Button](#pattern-13) | A tactile depress with a real bottom edge — pure CSS |
| 14 | [Star Rating](#pattern-14) | Hover previews a value, click locks it with a pop |
| 15 | [Floating Label](#pattern-15) | Placeholder lifts into a label on focus — pure CSS |
| 16 | [Copy Button](#pattern-16) | Icon crossfades to a check and the label swaps, then reverts |
| 17 | [Quantity Stepper](#pattern-17) | Value pops on each change; clamps at zero |
| 18 | [Choice Chips](#pattern-18) | Toggle filters that pop as they switch on and off |
| 19 | [PIN Input](#pattern-19) | Each digit pops and auto-advances to the next box |
| 20 | [Password Meter](#pattern-20) | Segments fill and shift color as strength climbs |
| 21 | [Pointer Tooltip](#pattern-21) | Label trails the cursor with eased follow |
| 22 | [Swipe to Reveal](#pattern-22) | Drag an item horizontally to expose action buttons |
| 23 | [Rotary Knob](#pattern-23) | Drag in a circle to set a value; snaps to detents on release |
| 24 | [Reorderable List](#pattern-24) | Drag items up and down; others shift to make room |
| 25 | [Expanding Search](#pattern-25) | Field grows on hover or focus, glide easing |
| 26 | [Squish Button](#pattern-26) | Compresses on press, springs back on release |
| 27 | [Toggle Pills](#pattern-27) | Selected pill pops with a spring scale |
| 28 | [Value Scrubber](#pattern-28) | Drag horizontally to scrub the number |
| 29 | [Speed-Dial FAB](#pattern-29) | Actions fan out on a staggered spring |
| 30 | [Swatch Picker](#pattern-30) | Selected colour springs up with a check |
| 31 | [Slide to Unlock](#pattern-31) | Drag past the latch or it springs back |
| 32 | [Tag Input](#pattern-32) | Enter pops a chip in; × pops it out |
| 33 | [Keycap Press](#pattern-33) | Mechanical keycap depresses on its shadow |
| 34 | [Orbital Action Menu](#pattern-34) | Actions escape a magnetic centre on hover |
| 35 | [Contextual Dock](#pattern-35) | Nearby controls swell in a soft focus field |
| 36 | [Inertial Dial](#pattern-36) | A weighted needle catches up after the ring turns |
| 37 | [Elastic Lasso](#pattern-37) | Drag a selection field across the constellation |
| 38 | [Hover Intent Gate](#pattern-38) | A deliberate hover quietly unlocks the action |
| 39 | [Gesture Chord](#pattern-39) | Tap the keys in sequence to arm a shortcut |
| 40 | [Liquid Glass Press](#pattern-40) | Frosted glass liquefies under a specular press |
| 41 | [Bento Expand](#pattern-41) | Hover focuses one tile; the rest quietly recede |
| 42 | [Snap Rail](#pattern-42) | A soft selection pill springs to the hovered option |
| 43 | [Kinetic XY Pad](#pattern-43) | A two-axis puck trails the pointer, then springs home |
| 44 | [Command Palette Bloom](#pattern-44) | A compact trigger unfolds into a staggered action lens |
| 45 | [Momentum Picker](#pattern-45) | Wheel input rolls a weighted selector into its next detent |
| 46 | [Prompt Composer](#pattern-46) | An AI input grows with the thought, then commits to a run |
| 47 | [Filmstrip Scrubber](#pattern-47) | A playhead snaps to the frame nearest the pointer |
| 48 | [Drag Stack Collect](#pattern-48) | Loose items gather into a fanned pile under the pointer |
| 49 | [Focus Relay](#pattern-49) | A shared focus ring leaps between fields with a spring morph |
| 50 | [Hold to Talk](#pattern-50) | A live waveform blooms while you hold, then commits on release |
| 51 | [Lattice Snap](#pattern-51) | A tile follows the pointer, then springs onto the nearest cell |

## Source and attribution

Source: [Kinetics by Colorion / ckissi](https://kinetics.colorion.co/#library) · [upstream repository](https://github.com/ckissi/kinetics).
Pinned commit: `017498f8ae0e728ce7461852070d22601dd0a46e`. Captured October 7, 2026 (America/Phoenix).
The website footer declares “153 motion patterns. CSS + React. MIT licensed.” The pinned repository contains no standalone LICENSE file or copyright notice; this package preserves the published declaration and author/repository attribution without inventing missing license text. Source panels are copied examples; the surrounding selection and adaptation guidance was authored for this package.

## Complete source panels


## Pattern 01

# Card Resize

Pattern 01 of 51 · Interaction and Input Skills

Height spring with no JS layout thrash

Source readout: `spring(320, 24)`

## Original AI prompt

```text
Build a card that expands and collapses its height when clicked. Animate only the height with a single spring-like cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.5s so it gently overshoots before settling, and fade in secondary text with a small delay once expanded. Pure CSS transitions — no JS height measurement, no max-height hacks.
```

## Original CSS

```css
.card {
  height: 64px;
  overflow: hidden;
  transition: height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card.expanded {
  height: 120px;
}
```

## Original React

```jsx
function SpringCard() {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      style={{
        height: open ? 120 : 64,
        overflow: 'hidden',
        transition: 'height 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <p>Tap to expand</p>
    </div>
  );
}
```


## Pattern 02

# Magnetic Button

Pattern 02 of 51 · Interaction and Input Skills

Cursor pulls the button toward it inside a dead zone

Source readout: `magnet(0.35)`

## Original AI prompt

```text
Build a button that is magnetically pulled toward the cursor while the pointer is inside its surrounding zone. On mousemove, translate the button toward the pointer by ~35% of the offset from its center; reset to translate(0,0) on mouseleave. Use a short transform transition (~0.15s ease-out) so it glides rather than snaps.
```

## Original CSS

```css
.magnet-btn {
  transition: transform 0.15s ease-out;
}
/* JS computes offset from pointer to center,
   multiplies by a pull factor, applies translate */
```

## Original React

```jsx
function MagneticButton() {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    ref.current.style.transform =
      `translate(${x * 0.35}px, ${y * 0.35}px)`;
  };
  const onLeave = () => {
    ref.current.style.transform = 'translate(0,0)';
  };
  return (
    <div onMouseMove={onMove} onMouseLeave={onLeave}>
      <button ref={ref} style={{ transition: 'transform .15s ease-out' }}>
        Hover near me
      </button>
    </div>
  );
}
```


## Pattern 03

# Number Counter

Pattern 03 of 51 · Interaction and Input Skills

Digit bumps and overshoots on every increment

Source readout: `spring(280, 18)`

## Original AI prompt

```text
Build a number that increments on click and bumps elastically each time. On each increment briefly apply scale(1.22) translateY(-6px), then settle back with a spring cubic-bezier(0.34,1.56,0.64,1) over ~0.4s. Restart the animation cleanly on rapid clicks by forcing a reflow.
```

## Original CSS

```css
.digit {
  display: inline-block;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.digit.bump {
  transform: scale(1.25) translateY(-6px);
}
```

## Original React

```jsx
function ElasticCounter() {
  const [val, setVal] = useState(12);
  const [bump, setBump] = useState(false);

  const increment = () => {
    setVal(v => v + 1);
    setBump(true);
    setTimeout(() => setBump(false), 400);
  };

  return (
    <span
      onClick={increment}
      style={{
        display: 'inline-block',
        transform: bump ? 'scale(1.25) translateY(-6px)' : 'none',
        transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      {val}
    </span>
  );
}
```


## Pattern 04

# Toast Overshoot

Pattern 04 of 51 · Interaction and Input Skills

Slides past rest position before settling

Source readout: `overshoot(1.08)`

## Original AI prompt

```text
Build a toast that slides up from the bottom, overshoots its rest position, then settles. Transition transform from translateY(140%) scale(0.9) to translateY(0) scale(1) with cubic-bezier(0.18,1.25,0.4,1) over ~0.55s while opacity fades in. Auto-hide after a couple seconds.
```

## Original CSS

```css
.toast {
  transform: translate(-50%, 140%) scale(0.9);
  opacity: 0;
  transition: transform 0.55s cubic-bezier(0.18, 1.25, 0.4, 1),
              opacity 0.3s;
}
.toast.show {
  transform: translate(-50%, 0) scale(1);
  opacity: 1;
}
```

## Original React

```jsx
function Toast({ message, show }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: show
          ? 'translate(-50%, 0) scale(1)'
          : 'translate(-50%, 140%) scale(0.9)',
        opacity: show ? 1 : 0,
        transition:
          'transform .55s cubic-bezier(.18,1.25,.4,1), opacity .3s',
      }}
    >
      {message}
    </div>
  );
}
```


## Pattern 05

# Tab Pill Glide

Pattern 05 of 51 · Interaction and Input Skills

Indicator measures target width before moving

Source readout: `glide(0.4s, custom)`

## Original AI prompt

```text
Build a segmented tab control where a highlighted pill slides between tabs. On click, read the target button's offsetLeft and offsetWidth and animate the pill's left and width to match with cubic-bezier(0.65,0,0.35,1) over ~0.4s; the active label color crossfades as the pill arrives.
```

## Original CSS

```css
.pill {
  position: absolute;
  transition: left 0.4s cubic-bezier(0.65, 0, 0.35, 1),
              width 0.4s cubic-bezier(0.65, 0, 0.35, 1);
}
/* JS sets pill.style.left/width to the active
   button's offsetLeft/offsetWidth on click */
```

## Original React

```jsx
function GlidingTabs({ tabs }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  const [style, setStyle] = useState({});

  useEffect(() => {
    const el = refs.current[active];
    if (el) setStyle({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          ...style,
          transition: 'left .4s cubic-bezier(.65,0,.35,1), width .4s cubic-bezier(.65,0,.35,1)',
        }}
      />
      {tabs.map((t, i) => (
        <button key={t} ref={el => (refs.current[i] = el)} onClick={() => setActive(i)}>
          {t}
        </button>
      ))}
    </div>
  );
}
```


## Pattern 06

# Accordion Spring

Pattern 06 of 51 · Interaction and Input Skills

Max-height transition with rotating chevron

Source readout: `spring(260, 28)`

## Original AI prompt

```text
Build an accordion whose panels open with a springy feel and a rotating chevron. Animate max-height (0 to content height) with cubic-bezier(0.16,1,0.3,1) and rotate the chevron 180deg with a springy cubic-bezier(0.34,1.56,0.64,1). Pure CSS toggled by an .open class.
```

## Original CSS

```css
.acc-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.acc-item.open .acc-body {
  max-height: 100px;
}
.chev {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.acc-item.open .chev {
  transform: rotate(180deg);
}
```

## Original React

```jsx
function AccordionItem({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>
        {title}
        <span style={{ transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)' }}>⌄</span>
      </button>
      <div style={{
        maxHeight: open ? 100 : 0,
        overflow: 'hidden',
        transition: 'max-height .45s cubic-bezier(.16,1,.3,1)',
      }}>
        {children}
      </div>
    </div>
  );
}
```


## Pattern 07

# Drag to Dismiss

Pattern 07 of 51 · Interaction and Input Skills

Pointer-tracked drag, snaps back or flies off past threshold

Source readout: `friction(0.92)`

## Original AI prompt

```text
Build a card you can drag horizontally with the pointer to dismiss. Track pointerdown/move/up, translate by the drag delta plus a subtle rotation, and fade opacity with distance. On release past a 100px threshold fling it off-screen; otherwise spring it back with cubic-bezier(0.34,1.56,0.64,1).
```

## Original CSS

```css
.drag-card {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.35s;
  touch-action: none;
}
.drag-card.snap-back {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* JS tracks pointerdown/move/up, applies translate
   proportional to drag distance, checks threshold on release */
```

## Original React

```jsx
function DraggableCard({ onDismiss, children }) {
  const [x, setX] = useState(0);
  const start = useRef(0);
  const dragging = useRef(false);

  const onDown = (e) => { dragging.current = true; start.current = e.clientX; };
  const onMove = (e) => {
    if (!dragging.current) return;
    setX(e.clientX - start.current);
  };
  const onUp = () => {
    dragging.current = false;
    if (Math.abs(x) > 100) onDismiss();
    else setX(0);
  };

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{
        transform: `translateX(${x}px) rotate(${x * 0.05}deg)`,
        opacity: Math.max(1 - Math.abs(x) / 250, 0.3),
        transition: dragging.current ? 'none' : 'transform .5s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      {children}
    </div>
  );
}
```


## Pattern 08

# Ripple Feedback

Pattern 08 of 51 · Interaction and Input Skills

Radial fade-out anchored to the exact click point

Source readout: `decay(600ms)`

## Original AI prompt

```text
Build a button with a material-style ripple that starts at the exact click point. On click, spawn an absolutely-positioned circle at the pointer coordinates inside an overflow-hidden button, animate it from scale(0) to scale(2.6) while fading out over ~0.6s, then remove it.
```

## Original CSS

```css
.ripple-btn {
  position: relative;
  overflow: hidden;
}
.ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255,138,0,0.4);
  transform: scale(0);
  animation: ripple-out 0.6s ease-out;
}
@keyframes ripple-out {
  to { transform: scale(3); opacity: 0; }
}
```

## Original React

```jsx
function RippleButton({ children }) {
  const [ripples, setRipples] = useState([]);

  const addRipple = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const id = Date.now();
    setRipples(prev => [...prev, {
      id, size,
      x: e.clientX - r.left - size / 2,
      y: e.clientY - r.top - size / 2,
    }]);
    setTimeout(() => setRipples(prev => prev.filter(rp => rp.id !== id)), 650);
  };

  return (
    <button onClick={addRipple} style={{ position: 'relative', overflow: 'hidden' }}>
      {children}
      {ripples.map(rp => (
        <span key={rp.id} className="ripple" style={{
          width: rp.size, height: rp.size, left: rp.x, top: rp.y,
        }} />
      ))}
    </button>
  );
}
```


## Pattern 09

# Hold to Confirm

Pattern 09 of 51 · Interaction and Input Skills

Press and hold; a ring fills, release early to cancel

Source readout: `hold(800ms)`

## Original AI prompt

```text
Build a circular 'hold to confirm' button with an SVG progress ring. On pointerdown animate the ring's stroke-dashoffset from full to 0 over 800ms linear; if held the whole time fire confirm and flash a success state, otherwise cancel and snap the ring back on early release.
```

## Original CSS

```css
.hold-btn .prog {
  stroke-dasharray: 207;
  stroke-dashoffset: 207;            /* empty ring */
  transition: stroke-dashoffset 0.2s ease-out;
}
.hold-btn.holding .prog {
  stroke-dashoffset: 0;              /* fill over the hold */
  transition: stroke-dashoffset 0.8s linear;
}
/* JS adds .holding on pointerdown, and a 800ms timer
   promotes it to .done (or cancels on early release). */
```

## Original React

```jsx
function HoldToConfirm({ onConfirm, ms = 800 }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);

  const start = () => {
    setHolding(true);
    timer.current = setTimeout(() => { setHolding(false); onConfirm(); }, ms);
  };
  const cancel = () => { clearTimeout(timer.current); setHolding(false); };

  return (
    <button
      className={holding ? 'hold-btn holding' : 'hold-btn'}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
    >
      <svg className="ring" viewBox="0 0 72 72">
        <circle className="track" cx="36" cy="36" r="33" />
        <circle className="prog" cx="36" cy="36" r="33" />
      </svg>
      <span>Hold</span>
    </button>
  );
}
```


## Pattern 10

# Rubber-band Slider

Pattern 10 of 51 · Interaction and Input Skills

Drag past either end and it stretches, then springs back

Source readout: `rubber(0.32)`

## Original AI prompt

```text
Build a horizontal slider whose thumb resists past the ends like a rubber band. While dragging, map the pointer to 0–1, but when it exceeds the range add only ~32% of the overshoot so it stretches; on release remove the overshoot and spring the thumb back into range with cubic-bezier(0.34,1.56,0.64,1).
```

## Original CSS

```css
.thumb {
  transition: none;                 /* follows the pointer 1:1 */
}
.thumb.snap {
  transition: left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Past the ends, JS adds only 32% of the overshoot:
   pct = clamped + (raw - clamped) * 0.32  — the rubber band.
   On release it removes the overshoot and lets .snap spring home. */
```

## Original React

```jsx
function RubberSlider() {
  const track = useRef(null);
  const [pct, setPct] = useState(0.5);
  const [snap, setSnap] = useState(false);

  const at = (clientX, rubber) => {
    const r = track.current.getBoundingClientRect();
    const raw = (clientX - r.left) / r.width;
    const clamped = Math.min(Math.max(raw, 0), 1);
    return rubber ? clamped + (raw - clamped) * 0.32 : clamped;
  };

  return (
    <div ref={track} className="track"
      onPointerMove={(e) => e.buttons && (setSnap(false), setPct(at(e.clientX, true)))}
      onPointerUp={(e) => { setSnap(true); setPct(at(e.clientX, false)); }}
    >
      <span className={snap ? 'thumb snap' : 'thumb'} style={{ left: `${pct * 100}%` }} />
    </div>
  );
}
```


## Pattern 11

# Like Burst

Pattern 11 of 51 · Interaction and Input Skills

Toggles, pops the heart, and emits a radial particle ring

Source readout: `burst(heart)`

## Original AI prompt

```text
Build a like button that pops its heart and emits a particle burst when toggled on. Scale the heart to ~1.35 and back with a spring curve, fill it with the accent color, increment the count, and spawn ~8 small particles outward on an even circle that translate out and shrink to scale(0) over ~0.6s.
```

## Original CSS

```css
.heart { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.like-btn.pop .heart { transform: scale(1.35); }
.like-btn.liked .heart { fill: #FF8A00; stroke: #FF8A00; }

.particle { animation: fly 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fly { to { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
/* JS spawns 8 particles on a circle each time it's liked. */
```

## Original React

```jsx
function LikeButton({ start = 128 }) {
  const [liked, setLiked] = useState(false);
  const [bits, setBits] = useState([]);

  const toggle = () => {
    const next = !liked;
    setLiked(next);
    if (next) {
      setBits(Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8, d = 28;
        return { id: Date.now() + i, tx: Math.cos(a) * d, ty: Math.sin(a) * d };
      }));
      setTimeout(() => setBits([]), 600);
    }
  };

  return (
    <button className={liked ? 'like-btn liked pop' : 'like-btn'} onClick={toggle}>
      <Heart /> <span>{start + (liked ? 1 : 0)}</span>
      {bits.map(b => (
        <span key={b.id} className="particle"
          style={{ '--tx': `${b.tx}px`, '--ty': `${b.ty}px` }} />
      ))}
    </button>
  );
}
```


## Pattern 12

# Cursor Trail

Pattern 12 of 51 · Interaction and Input Skills

A chain of dots chases the pointer with eased lag

Source readout: `trail(0.35)`

## Original AI prompt

```text
Build a contained area where a chain of dots follows the cursor with eased lag. Track the pointer; each animation frame, lerp each dot ~35% toward the dot ahead of it (the first toward the cursor) so they form a comet tail. Decrease size and opacity down the chain and hide when the pointer leaves.
```

## Original CSS

```css
/* Pure transform work — no layout. Each dot eases toward
   the one ahead of it, so the chain lags into a comet tail. */
.trail-dot { position: absolute; will-change: transform; }
.trail-dot:nth-child(2) { opacity: 0.85; }
.trail-dot:nth-child(3) { opacity: 0.7; }
/* ...decreasing size + opacity down the chain... */
```

## Original React

```jsx
function CursorTrail({ count = 6 }) {
  const dots = useRef([]);
  const pts = useRef(Array.from({ length: count }, () => ({ x: 0, y: 0 })));
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let id;
    const tick = () => {
      let lead = target.current;
      pts.current.forEach((p, i) => {
        p.x += (lead.x - p.x) * 0.35;
        p.y += (lead.y - p.y) * 0.35;
        const el = dots.current[i];
        if (el) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        lead = p;
      });
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div onPointerMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect();
      target.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} ref={el => (dots.current[i] = el)} className="trail-dot" />
      ))}
    </div>
  );
}
```


## Pattern 13

# Push Button

Pattern 13 of 51 · Interaction and Input Skills

A tactile depress with a real bottom edge — pure CSS

Source readout: `press(60ms)`

## Original AI prompt

```text
Build a button that physically depresses when pressed, pure CSS. Give it a solid bottom box-shadow to act as a 3D edge; on :active translateY it down by the edge height and shrink the shadow to ~1px over ~0.06s so it reads as a tactile push.
```

## Original CSS

```css
.push-btn {
  border-radius: 12px;
  background: #FF8A00;
  color: #0E0E10;
  box-shadow: 0 6px 0 #B36200;
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}
.push-btn:active {
  transform: translateY(5px);
  box-shadow: 0 1px 0 #B36200;
}
```

## Original React

```jsx
function PushButton({ children }) {
  // Pure CSS: the bottom box-shadow is the button's "edge".
  // :active drops it down and shrinks the edge so it reads
  // as a physical press — pair this with the .push-btn rule.
  return (
    <button className="push-btn">
      {children}
    </button>
  );
}
```


## Pattern 14

# Star Rating

Pattern 14 of 51 · Interaction and Input Skills

Hover previews a value, click locks it with a pop

Source readout: `rate(0..5)`

## Original AI prompt

```text
Build a five-star rating control. On hover, light every star up to the hovered index in the accent color as a live preview; on click, lock that value and briefly pop the clicked star with a spring scale. On mouse leave, fall back to showing the locked value.
```

## Original CSS

```css
.star {
  color: #2A2A2E;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              color 0.15s ease;
}
.star.on { color: #FF8A00; }
.star.pop { transform: scale(1.3); }
/* JS toggles .on for stars up to the hovered/selected
   index, and flashes .pop on the one just clicked. */
```

## Original React

```jsx
function StarRating({ count = 5 }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <div onMouseLeave={() => setHover(0)}>
      {Array.from({ length: count }).map((_, i) => {
        const n = i + 1;
        const lit = (hover || value) >= n;
        return (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onClick={() => setValue(n)}
            style={{ color: lit ? '#FF8A00' : '#2A2A2E' }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
```


## Pattern 15

# Floating Label

Pattern 15 of 51 · Interaction and Input Skills

Placeholder lifts into a label on focus — pure CSS

Source readout: `focus(label)`

## Original AI prompt

```text
Build a text field whose placeholder floats up into a label when focused or filled, pure CSS. Give the input a single-space placeholder so :placeholder-shown reflects emptiness; position the label over the input and, on input:focus or :not(:placeholder-shown), translate it up and scale it down into the accent color over ~0.2s.
```

## Original CSS

```css
.field { position: relative; }
.field label {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  color: #6E6C68;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              color 0.2s, font-size 0.2s;
}
/* Empty uses :placeholder-shown; lift on focus or value */
.field input:focus + label,
.field input:not(:placeholder-shown) + label {
  transform: translateY(-26px) scale(0.85);
  color: #FF8A00;
}
```

## Original React

```jsx
function FloatingField({ label }) {
  // The motion is pure CSS: keep a " " placeholder so
  // :placeholder-shown tracks emptiness, and animate the
  // adjacent label on :focus / :not(:placeholder-shown).
  return (
    <div className="field">
      <input id="email" placeholder=" " />
      <label htmlFor="email">{label}</label>
    </div>
  );
}
```


## Pattern 16

# Copy Button

Pattern 16 of 51 · Interaction and Input Skills

Icon crossfades to a check and the label swaps, then reverts

Source readout: `copy(1.4s)`

## Original AI prompt

```text
Build a copy-to-clipboard button that confirms with a crossfade. On click write the value to the clipboard, then crossfade the copy glyph out and a green check in with a spring scale while the label swaps from "Copy" to "Copied"; revert both after ~1.4s.
```

## Original CSS

```css
.copy-icon { position: relative; }
.copy-icon svg {
  position: absolute; inset: 0;
  transition: opacity 0.2s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ic-check { opacity: 0; transform: scale(0.5); color: #4CD08A; }
.copy-btn.copied .ic-copy  { opacity: 0; transform: scale(0.5); }
.copy-btn.copied .ic-check { opacity: 1; transform: scale(1); }
/* JS writes to the clipboard, adds .copied + swaps the
   label to "Copied", then reverts after ~1.4s. */
```

## Original React

```jsx
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button className={copied ? 'copy-btn copied' : 'copy-btn'} onClick={copy}>
      <span className="copy-icon">
        <CopyIcon className="ic-copy" />
        <CheckIcon className="ic-check" />
      </span>
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
```


## Pattern 17

# Quantity Stepper

Pattern 17 of 51 · Interaction and Input Skills

Value pops on each change; clamps at zero

Source readout: `step(spring)`

## Original AI prompt

```text
Build a quantity stepper with − and + buttons around a number. On each change update the value (clamped at a minimum) and briefly pop it with a spring scale(1.3) that settles via cubic-bezier(0.34,1.56,0.64,1); dip the pressed button with a quick scale(0.9) on :active. Use tabular-nums so the digits don't shift.
```

## Original CSS

```css
.step-val {
  display: inline-block;
  min-width: 2ch; text-align: center;
  font-variant-numeric: tabular-nums;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.step-val.bump { transform: scale(1.3); }
.step-btn:active { transform: scale(0.9); }
```

## Original React

```jsx
function Stepper({ min = 0 }) {
  const [n, setN] = useState(1);
  const [bump, setBump] = useState(false);

  const change = (d) => {
    setN((v) => Math.max(min, v + d));
    setBump(true);
    setTimeout(() => setBump(false), 350);
  };

  return (
    <div className="stepper">
      <button className="step-btn" onClick={() => change(-1)}>−</button>
      <span className={bump ? 'step-val bump' : 'step-val'}>{n}</span>
      <button className="step-btn" onClick={() => change(1)}>+</button>
    </div>
  );
}
```


## Pattern 18

# Choice Chips

Pattern 18 of 51 · Interaction and Input Skills

Toggle filters that pop as they switch on and off

Source readout: `select(pop)`

## Original AI prompt

```text
Build a row of selectable filter chips. Clicking a chip toggles an .on state that fills it with the accent color and flips the text to the dark background color, with a brief spring pop (scale ~1.12) on each toggle. Multiple chips can be active at once.
```

## Original CSS

```css
.chip {
  padding: 7px 15px; border-radius: 100px;
  border: 1px solid #2A2A2E; color: #A8A6A0;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.2s, color 0.2s, border-color 0.2s;
}
.chip.on {
  background: #FF8A00; color: #0E0E10; border-color: #FF8A00;
}
.chip.pop { transform: scale(1.12); }
```

## Original React

```jsx
function ChoiceChips({ options }) {
  const [on, setOn] = useState(() => new Set());

  const toggle = (opt) =>
    setOn((prev) => {
      const next = new Set(prev);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      return next;
    });

  return (
    <div>
      {options.map((opt) => (
        <button
          key={opt}
          className={on.has(opt) ? 'chip on' : 'chip'}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
```


## Pattern 19

# PIN Input

Pattern 19 of 51 · Interaction and Input Skills

Each digit pops and auto-advances to the next box

Source readout: `spring(360, 22)`

## Original AI prompt

```text
Build a one-time-code / PIN input of four single-character boxes. When a digit is typed, mark that box filled (accent border) and give it a brief spring pop (scale ~1.14 with cubic-bezier(0.34, 1.56, 0.64, 1)), then move focus to the next box automatically. On Backspace in an empty box, move focus to the previous box. Keep focus rings on the active box.
```

## Original CSS

```css
.pin-box {
  width: 44px; height: 52px;
  text-align: center;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 0.2s ease;
}
.pin-box.filled { border-color: var(--amber); }
.pin-box.pop { transform: scale(1.14); }
.pin-box:focus { border-color: var(--amber); outline: none; }
```

## Original React

```jsx
function PinInput({ length = 4 }) {
  const refs = useRef([]);
  const onChange = (i, e) => {
    const el = e.target;
    if (el.value) {
      el.classList.add('filled', 'pop');
      setTimeout(() => el.classList.remove('pop'), 350);
      refs.current[i + 1]?.focus();
    } else {
      el.classList.remove('filled');
    }
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !e.target.value)
      refs.current[i - 1]?.focus();
  };
  return (
    <div>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          maxLength={1}
          ref={(el) => (refs.current[i] = el)}
          onChange={(e) => onChange(i, e)}
          onKeyDown={(e) => onKey(i, e)}
        />
      ))}
    </div>
  );
}
```


## Pattern 20

# Password Meter

Pattern 20 of 51 · Interaction and Input Skills

Segments fill and shift color as strength climbs

Source readout: `tween(score)`

## Original AI prompt

```text
Build a password strength meter of four segment bars under a text field. On every keystroke score the value (length tiers, plus a point each for containing a digit and a symbol), clamp to 0–4, and reveal that many bars by scaling them from scaleX(0) to scaleX(1) with a spring cubic-bezier(0.34, 1.56, 0.64, 1). Tint the filled bars red at weak, amber at medium, green at strong, and show a matching text label.
```

## Original CSS

```css
.meter span {
  flex: 1; height: 5px; border-radius: 3px;
  background: var(--card-2);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.meter[data-score="1"] span:nth-child(-n+1),
.meter[data-score="2"] span:nth-child(-n+2),
.meter[data-score="3"] span:nth-child(-n+3),
.meter[data-score="4"] span { transform: scaleX(1); }
```

## Original React

```jsx
function PasswordMeter() {
  const [score, setScore] = useState(0);
  const rate = (v) => {
    let s = 0;
    if (v.length > 4) s++;
    if (v.length > 8) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^a-zA-Z0-9]/.test(v)) s++;
    return Math.min(s, 4);
  };
  const colors = ['#FF5C5C', '#FF8A00', '#FF8A00', '#4CD08A'];
  return (
    <div>
      <input onChange={(e) => setScore(rate(e.target.value))} />
      <div className="meter">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              transform: i < score ? 'scaleX(1)' : 'scaleX(0)',
              background: colors[score - 1],
            }}
          />
        ))}
      </div>
    </div>
  );
}
```


## Pattern 21

# Pointer Tooltip

Pattern 21 of 51 · Interaction and Input Skills

Label trails the cursor with eased follow

Source readout: `lerp(0.18)`

## Original AI prompt

```text
Build a tooltip label that smoothly trails the cursor inside a zone. On mousemove store the target x/y relative to the zone; in a requestAnimationFrame loop, lerp the label's current position toward the target by ~0.18 each frame and apply it as a translate, so it eases behind the pointer instead of snapping. Fade the label in on hover and show the live coordinates.
```

## Original CSS

```css
.tip {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.zone:hover .tip { opacity: 1; }
/* JS lerps tip x/y toward the pointer each frame */
```

## Original React

```jsx
function PointerTooltip() {
  const ref = useRef(null);
  const pos = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    let raf;
    const loop = () => {
      const p = pos.current;
      p.x += (p.tx - p.x) * 0.18;
      p.y += (p.ty - p.y) * 0.18;
      if (ref.current)
        ref.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    pos.current.tx = e.clientX - r.left;
    pos.current.ty = e.clientY - r.top;
  };
  return (
    <div onMouseMove={onMove} style={{ position: 'relative' }}>
      <span ref={ref} className="tip">follow</span>
    </div>
  );
}
```


## Pattern 22

# Swipe to Reveal

Pattern 22 of 51 · Interaction and Input Skills

Drag an item horizontally to expose action buttons

Source readout: `swipe(-96px)`

## Original AI prompt

```text
Build a list item that can be swiped left to reveal archive and delete action buttons behind it. Track pointerdown/move/up, translate the item left following the pointer (clamped to 0 on the right). On release, if dragged past ~96px add an .open class that holds it at translateX(-96px) with a spring transition; otherwise spring it back to 0. The action buttons sit absolutely behind the item.
```

## Original CSS

```css
.swipe-item {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.swipe-item.dragging { transition: none; }
.swipe-item.open { transform: translateX(-96px); }
```

## Original React

```jsx
function SwipeToReveal() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const start = useRef(0);
  const dragging = useRef(false);

  const onDown = (e) => {
    dragging.current = true;
    start.current = e.clientX;
    ref.current.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const dx = Math.min(0, e.clientX - start.current);
    ref.current.style.transform = `translateX(${dx}px)`;
  };
  const onUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    ref.current.classList.remove('dragging');
    const dx = e.clientX - start.current;
    setOpen(dx < -96);
    ref.current.style.transform = '';
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: 0 }}>
        <button>Archive</button>
        <button>Delete</button>
      </div>
      <div
        ref={ref}
 className={open ? 'swipe-item open' : 'swipe-item'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        Swipe me left
      </div>
    </div>
  );
}
```


## Pattern 23

# Rotary Knob

Pattern 23 of 51 · Interaction and Input Skills

Drag in a circle to set a value; snaps to detents on release

Source readout: `rotate(0..270)`

## Original AI prompt

```text
Build a rotary knob that the user can drag in a circle to set a value from 0 to 270 degrees. On pointerdown record the starting angle from the knob center; on pointermove compute the delta angle, clamp it to 0–270, and rotate the knob. On release snap to the nearest detent (e.g. 10 steps) with a spring cubic-bezier(0.34,1.56,0.64,1). Show the current value as a number below the knob and fill an SVG arc proportional to the angle.
```

## Original CSS

```css
.knob {
  border-radius: 50%;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.knob.dragging { transition: none; }
.knob::before {
  content: '';
  position: absolute; top: 8px; left: 50%;
  width: 4px; height: 16px; margin-left: -2px;
  border-radius: 2px; background: #FF8A00;
}
```

## Original React

```jsx
function RotaryKnob({ max = 270, steps = 10 }) {
  const ref = useRef(null);
  const [angle, setAngle] = useState(0);
  const dragging = useRef(false);
  const prevAngle = useRef(0);
  const pointerOffset = 225;

  const getAngle = (e) => {
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
  };

  const onDown = (e) => {
    dragging.current = true;
    prevAngle.current = getAngle(e);
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const cur = getAngle(e);
    let delta = cur - prevAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    prevAngle.current = cur;
    setAngle((a) => Math.min(max, Math.max(0, a + delta)));
  };
  const onUp = () => {
    dragging.current = false;
    setAngle((a) => Math.round(a / (max / steps)) * (max / steps));
  };

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ transform: `rotate(${angle + pointerOffset}deg)`, transition: dragging.current ? 'none' : 'transform .5s cubic-bezier(.34,1.56,.64,1)' }}
    />
  );
}
```


## Pattern 24

# Reorderable List

Pattern 24 of 51 · Interaction and Input Skills

Drag items up and down; others shift to make room

Source readout: `reorder(y-axis)`

## Original AI prompt

```text
Build a reorderable vertical list where items can be dragged up or down to rearrange. On pointerdown on an item, mark it as dragging (disable its transition, add a shadow). On pointermove translate it by the drag delta; when it crosses the midpoint of an adjacent item, swap their positions in the array and reset the drag origin so the dragged item stays under the cursor. On release, snap it into place with a glide cubic-bezier(0.16,1,0.3,1) transition. Show a drag handle on each item.
```

## Original CSS

```css
.reorder-item {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.2s, box-shadow 0.2s;
}
.reorder-item.dragging {
  transition: none;
  opacity: 0.9;
  box-shadow: 0 8px 24px -6px rgba(0,0,0,0.6);
  z-index: 10;
}
```

## Original React

```jsx
function ReorderList({ items: initial }) {
  const [items, setItems] = useState(initial);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const itemH = 44;

  const onDown = (i, e) => {
    setDragIdx(i);
    startY.current = e.clientY;
  };
  const onMove = (e) => {
    if (dragIdx === null) return;
    const dy = e.clientY - startY.current;
    setDragY(dy);
    const target = Math.min(items.length - 1,
      Math.max(0, Math.round((i * itemH + dy) / itemH)));
    if (target !== dragIdx) {
      const next = [...items];
      const [m] = next.splice(dragIdx, 1);
      next.splice(target, 0, m);
      setItems(next);
      setDragIdx(target);
      startY.current = e.clientY;
      setDragY(0);
    }
  };
  const onUp = () => { setDragIdx(null); setDragY(0); };

  return (
    <div onPointerMove={onMove} onPointerUp={onUp}>
      {items.map((item, i) => (
        <div
          key={item}
          onPointerDown={(e) => onDown(i, e)}
          style={{
            transform: dragIdx === i ? `translateY(${dragY}px)` : '',
            transition: dragIdx === i ? 'none' : 'transform .3s cubic-bezier(.16,1,.3,1)',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
```


## Pattern 25

# Expanding Search

Pattern 25 of 51 · Interaction and Input Skills

Field grows on hover or focus, glide easing

Source readout: `width 0.4s glide`

## Original AI prompt

```text
Build a pill-shaped search field that starts collapsed to just its icon (~56px) and expands to full width when focused. Use :focus-within and animate only the width over ~0.4s with a glide cubic-bezier(0.16, 1, 0.3, 1). Keep overflow hidden so the input text is clipped while collapsed, and let the icon stay pinned on the left.
```

## Original CSS

```css
.search {
  width: 56px;
  overflow: hidden;
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
/* label wrapper: click anywhere focuses the input */
.search:hover,
.search:focus-within {
  width: 230px;
}
```

## Original React

```jsx
function ExpandingSearch() {
  return (
    <div
      style={{
        width: 56,
        overflow: 'hidden',
        transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}
      onFocusCapture={(e) => (e.currentTarget.style.width = '230px')}
      onBlurCapture={(e) => (e.currentTarget.style.width = '56px')}
    >
      <SearchIcon />
      <input placeholder="Search…" />
    </div>
  );
}
```


## Pattern 26

# Squish Button

Pattern 26 of 51 · Interaction and Input Skills

Compresses on press, springs back on release

Source readout: `scale 0.88 spring`

## Original AI prompt

```text
Make a button that squishes down to ~88% scale the instant it is pressed (fast 0.08s ease-out) and springs back to full size on release with an overshooting cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.5s. The asymmetric timing — quick down, bouncy up — is what makes it feel physical. Drive it from :active.
```

## Original CSS

```css
.btn {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.btn:active {
  transform: scale(0.88);
  transition: transform 0.08s ease-out;
}
```

## Original React

```jsx
function SquishButton({ children }) {
  return (
    <button
      style={{ transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
      onPointerDown={(e) => {
        e.currentTarget.style.transition = 'transform 0.08s ease-out';
        e.currentTarget.style.transform = 'scale(0.88)';
      }}
      onPointerUp={(e) => {
        e.currentTarget.style.transition =
          'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </button>
  );
}
```


## Pattern 27

# Toggle Pills

Pattern 27 of 51 · Interaction and Input Skills

Selected pill pops with a spring scale

Source readout: `spring scale 1.06`

## Original AI prompt

```text
Build a row of rounded pill options backed by hidden radio inputs so only one is selected at a time. When a pill becomes checked, fill it with the accent colour and pop it to scale(1.06) using a spring cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.5s while colour/background ease over 0.25s. Use :checked + span so it works with zero JS.
```

## Original CSS

```css
.pill input { position: absolute; opacity: 0; }
.pill span {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.25s ease, color 0.25s ease;
}
.pill input:checked + span {
  background: #ff8a00;
  color: #0e0e10;
  transform: scale(1.06);
}
```

## Original React

```jsx
function TogglePills({ options }) {
  const [active, setActive] = useState(options[0]);
  return options.map((opt) => (
    <button
      key={opt}
      onClick={() => setActive(opt)}
      style={{
        transform: active === opt ? 'scale(1.06)' : 'scale(1)',
        background: active === opt ? '#ff8a00' : '#232326',
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {opt}
    </button>
  ));
}
```


## Pattern 28

# Value Scrubber

Pattern 28 of 51 · Interaction and Input Skills

Drag horizontally to scrub the number

Source readout: `drag · 1px = 1`

## Original AI prompt

```text
Build a draggable number scrubber: a large value you can click and drag horizontally to change, like a Blender/After Effects field. On pointerdown capture the start X and value; on pointermove add the pixel delta to the original value (1px ≈ 1 unit). Show an ew-resize cursor, pop the value to scale(1.06) with a spring while scrubbing, and release cleanly on pointerup.
```

## Original CSS

```css
.value {
  cursor: ew-resize;
  touch-action: none;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.value.scrubbing {
  color: #ff8a00;
  transform: scale(1.06);
}
```

## Original React

```jsx
function Scrubber({ start = 48 }) {
  const [v, setV] = useState(start);
  const onDown = (e) => {
    const x0 = e.clientX, v0 = v;
    const move = (m) => setV(v0 + Math.round(m.clientX - x0));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <span style={{ cursor: 'ew-resize' }} onPointerDown={onDown}>
      {v}
    </span>
  );
}
```


## Pattern 29

# Speed-Dial FAB

Pattern 29 of 51 · Interaction and Input Skills

Actions fan out on a staggered spring

Source readout: `stagger spring`

## Original AI prompt

```text
Build a floating action button that fans out 3 mini action buttons when toggled. Drive the open state from a hidden checkbox (label as the +) so it needs no JS. When checked, translate each item to a fanned position (upper-left, top, upper-right) and scale it from 0.4 to 1 using a spring cubic-bezier(0.34, 1.56, 0.64, 1), staggering transition-delay by ~50ms. Rotate the + icon to a × at the same time.
```

## Original CSS

```css
.item {
  opacity: 0;
  transform: scale(0.4);
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
}
:checked ~ .item:nth-of-type(1) { transform: translate(-54px, -58px); transition-delay: 0.02s; }
:checked ~ .item:nth-of-type(2) { transform: translate(0, -80px);     transition-delay: 0.07s; }
:checked ~ .item:nth-of-type(3) { transform: translate(54px, -58px);  transition-delay: 0.12s; }
:checked ~ .item { opacity: 1; }
```

## Original React

```jsx
function SpeedDial({ actions }) {
  const [open, setOpen] = useState(false);
  const fan = [[-54, -58], [0, -80], [54, -58]];
  return (
    <div>
      {actions.map((a, i) => (
        <button
          key={i}
          style={{
            transform: open
              ? `translate(${fan[i][0]}px, ${fan[i][1]}px)`
              : 'scale(0.4)',
            opacity: open ? 1 : 0,
            transitionDelay: `${i * 0.05}s`,
          }}
        >
          {a.icon}
        </button>
      ))}
      <button onClick={() => setOpen(!open)}>+</button>
    </div>
  );
}
```


## Pattern 30

# Swatch Picker

Pattern 30 of 51 · Interaction and Input Skills

Selected colour springs up with a check

Source readout: `spring scale 1.2`

## Original AI prompt

```text
Build a colour swatch picker: a row of circular swatches backed by hidden radio inputs. When one is checked, scale it to 1.2 with a spring cubic-bezier(0.34, 1.56, 0.64, 1), draw a ring around it using a double box-shadow in the swatch's own colour, and fade-pop a ✓ glyph in the centre. Pure CSS via :checked + span, only one selected at a time.
```

## Original CSS

```css
.swatch span {
  box-shadow: 0 0 0 2px #0e0e10;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s;
}
.swatch input:checked + span {
  transform: scale(1.2);
  box-shadow: 0 0 0 2px #0e0e10, 0 0 0 4px var(--c);
}
.swatch input:checked + span::after { content: "✓"; opacity: 1; }
```

## Original React

```jsx
function Swatches({ colors }) {
  const [active, setActive] = useState(colors[0]);
  return colors.map((c) => (
    <button
      key={c}
      onClick={() => setActive(c)}
      style={{
        background: c,
        transform: active === c ? 'scale(1.2)' : 'scale(1)',
        boxShadow:
          active === c ? `0 0 0 2px #0e0e10, 0 0 0 4px ${c}` : 'none',
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    />
  ));
}
```


## Pattern 31

# Slide to Unlock

Pattern 31 of 51 · Interaction and Input Skills

Drag past the latch or it springs back

Source readout: `snap · 85% latch`

## Original AI prompt

```text
Build an iOS-style slide-to-unlock control. A round thumb sits at the left of a pill track; dragging moves it 1:1 with the pointer (disable the transition while dragging) and a green fill grows behind it. On release, if the thumb passed ~85% of the track, latch it open at the far end and mark it unlocked; otherwise spring it back to the start with a cubic-bezier(0.34, 1.56, 0.64, 1).
```

## Original CSS

```css
.thumb {
  transition: left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.track.dragging .thumb { transition: none; }   /* follow finger 1:1 */
.track.unlocked .thumb { background: #4cd08a; }
```

## Original React

```jsx
function SlideUnlock({ onUnlock }) {
  const [x, setX] = useState(0);
  const max = 184;
  const onMove = (dx) => setX(Math.min(Math.max(dx, 0), max));
  const onEnd = () => {
    if (x >= max * 0.85) { setX(max); onUnlock(); }
    else setX(0); // spring back
  };
  return (
    <div className="track">
      <div
        className="thumb"
        style={{ left: x }}
        onPointerMove={(e) => e.buttons && onMove(x + e.movementX)}
        onPointerUp={onEnd}
      />
    </div>
  );
}
```


## Pattern 32

# Tag Input

Pattern 32 of 51 · Interaction and Input Skills

Enter pops a chip in; × pops it out

Source readout: `pop in / out`

## Original AI prompt

```text
Build a tag/token input. Typing a value and pressing Enter appends a pill that springs in from scale(0.4) with a cubic-bezier(0.34, 1.56, 0.64, 1) pop. Each pill has a × button that removes it with a quick scale-down fade. Pressing Backspace in the empty field removes the last tag. The field shares a bordered container with the pills and highlights on focus-within.
```

## Original CSS

```css
.tag { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.tag.removing { animation: out 0.24s ease forwards; }
@keyframes pop { from { transform: scale(0.4); opacity: 0; } }
@keyframes out { to   { transform: scale(0.4); opacity: 0; } }
```

## Original React

```jsx
function TagInput() {
  const [tags, setTags] = useState(['design', 'motion']);
  const add = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      setTags([...tags, e.target.value.trim()]);
      e.target.value = '';
    }
  };
  return (
    <div className="tags">
      {tags.map((t, i) => (
        <span key={i} className="tag">
          {t}
          <button onClick={() => setTags(tags.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
      <input onKeyDown={add} placeholder="Add tag…" />
    </div>
  );
}
```


## Pattern 33

# Keycap Press

Pattern 33 of 51 · Interaction and Input Skills

Mechanical keycap depresses on its shadow

Source readout: `translateY 6px`

## Original AI prompt

```text
Style a button as a 3D mechanical keycap. Give it a solid offset box-shadow (0 7px 0 a dark colour) to act as the key's side wall, plus a soft ambient shadow below. On :active, translate the cap down by the same 6–7px and shrink the side shadow to ~1px so it reads as physically bottoming out. Use a fast ~0.09s ease-out so the press feels crisp.
```

## Original CSS

```css
.key {
  box-shadow: 0 7px 0 0 #0c0c0e, 0 10px 16px -4px rgba(0,0,0,0.6);
  transition: transform 0.09s ease-out, box-shadow 0.09s ease-out;
}
.key:active {
  transform: translateY(6px);
  box-shadow: 0 1px 0 0 #0c0c0e, 0 2px 6px -2px rgba(0,0,0,0.6);
}
```

## Original React

```jsx
function Keycap({ label }) {
  return <button className="key">{label}</button>;
  // The :active state collapses the 7px bottom shadow
  // and pushes the cap down 6px — a 1:1 travel illusion.
}
```


## Pattern 34

# Orbital Action Menu

Pattern 34 of 51 · Interaction and Input Skills

Actions escape a magnetic centre on hover

Source readout: `radial · hover`

## Original AI prompt

```text
Build a compact radial action menu. A dark circular + button anchors the centre; four tiny actions begin stacked behind it, then orbit outward in cardinal directions on hover. Use independent translate transforms with a slightly overshooting spring so the menu feels magnetic rather than mechanically radial.
```

## Original CSS

```css
.menu:hover .action-n { transform: translateY(-52px); opacity: 1; }
.menu:hover .action-e { transform: translateX(52px); opacity: 1; }
/* give each action a different translate vector and spring transition */
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 35

# Contextual Dock

Pattern 35 of 51 · Interaction and Input Skills

Nearby controls swell in a soft focus field

Source readout: `:has() · 280ms`

## Original AI prompt

```text
Create a modern contextual dock using CSS :has(). The hovered icon rises and enlarges; its immediate neighbours get a smaller lift and scale. Keep the icons monochrome until focus, use a short spring transition, and let the dock settle naturally when the pointer moves away.
```

## Original CSS

```css
.dock button:hover { transform: translateY(-14px) scale(1.35); }
.dock button:has(+ button:hover), .dock button:hover + button { transform: translateY(-7px) scale(1.14); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 36

# Inertial Dial

Pattern 36 of 51 · Interaction and Input Skills

A weighted needle catches up after the ring turns

Source readout: `conic dial · hover`

## Original AI prompt

```text
Make a precision dial with a conic-gradient tick ring, central readout, and a needle that visibly lags behind the rotating housing. On hover rotate the outer dial, then counter-rotate the needle with a longer delayed spring transition so it feels like a real weighted instrument.
```

## Original CSS

```css
.dial:hover { transform: rotate(72deg); }
.dial:hover .needle { transform: rotate(-42deg); }
/* counter-rotate the needle with a delayed spring for inertia */
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 37

# Elastic Lasso

Pattern 37 of 51 · Interaction and Input Skills

Drag a selection field across the constellation

Source readout: `drag · collision`

## Original AI prompt

```text
Build a miniature drag-to-select surface. Pointer drag stretches a translucent lasso rectangle from its origin; dots touched by the rectangle spring larger and turn amber. Clear the selection on the next drag.
```

## Original CSS

```css
.lasso-box { border: 1px solid #ff8a00; background: rgba(255,138,0,.1); }
.dot.selected { transform: scale(1.45); background: #ff8a00; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 38

# Hover Intent Gate

Pattern 38 of 51 · Interaction and Input Skills

A deliberate hover quietly unlocks the action

Source readout: `intent · 700ms`

## Original AI prompt

```text
Create a hover-intent action that only arms after the pointer rests for 700ms. A hairline charge travels under the label; once complete, the label flips from STAY to ENTER. Leaving early instantly resets it.
```

## Original CSS

```css
.gate:hover i { transform: scaleX(1); transition: transform .7s linear; }
.gate:hover span { animation: unlock .01s .7s forwards; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 39

# Gesture Chord

Pattern 39 of 51 · Interaction and Input Skills

Tap the keys in sequence to arm a shortcut

Source readout: `sequence · K → X`

## Original AI prompt

```text
Make a two-key gesture chord. Tapping K then X depresses each physical keycap and reveals ARMED with a spring. A wrong order or a completed sequence resets after a short beat.
```

## Original CSS

```css
.chord button.hit { transform: translateY(4px); color: #ff8a00; }
.chord.done strong { opacity: 1; transform: translateY(0); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 40

# Liquid Glass Press

Pattern 40 of 51 · Interaction and Input Skills

Frosted glass liquefies under a specular press

Source readout: `glass · press`

## Original AI prompt

```text
Build a modern liquid-glass CTA. Use a frosted translucent surface with backdrop-filter blur and saturation, an inset top highlight, and soft ambient shadow. On hover drift the inner colour pools and sweep a specular streak across the face; on press, scale slightly down so it feels tactile and refractive rather than flat material.
```

## Original CSS

```css
.glass {
  backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}
.glass::after { /* specular streak */
  background: linear-gradient(105deg, transparent, rgba(255,255,255,.35), transparent);
  transition: transform .65s cubic-bezier(0.16,1,0.3,1);
}
.glass:hover::after { transform: translateX(220%); }
.glass:active { transform: scale(0.97); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 41

# Bento Expand

Pattern 41 of 51 · Interaction and Input Skills

Hover focuses one tile; the rest quietly recede

Source readout: `:has() · bento`

## Original AI prompt

```text
Create a miniature bento grid where hovering a tile lifts it with a spring scale and amber fill while siblings dim and shrink slightly via :has(). Keep labels monospaced and the layout uneven (one tall hero cell) so it feels editorial rather than a uniform dashboard grid.
```

## Original CSS

```css
.bento { display: grid; grid-template-columns: 1.1fr .9fr; gap: 7px; }
.bento span:hover {
  background: var(--amber);
  transform: scale(1.04);
}
.bento:has(span:hover) span:not(:hover) {
  opacity: .45;
  transform: scale(.96);
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 42

# Snap Rail

Pattern 42 of 51 · Interaction and Input Skills

A soft selection pill springs to the hovered option

Source readout: `snap · spring`

## Original AI prompt

```text
Build a segmented snap rail for Day / Week / Month. Use flex with three equal flex:1 buttons so labels stay horizontally centered in identical cells. A single pill pseudo-element is exactly calc((100% - padding) / 3) wide and slides with translateX(calc(var(--i) * 100%)) where --i is set via :has() on hover. Never size the pill to the text — always to the equal column.
```

## Original CSS

```css
.rail {
  display: flex;
  padding: 4px;
  --i: 0;
}
.rail::before {
  position: absolute;
  top: 4px; bottom: 4px; left: 4px;
  width: calc((100% - 8px) / 3); /* one equal third */
  transform: translateX(calc(var(--i) * 100%));
  transition: transform .45s cubic-bezier(0.34,1.56,0.64,1);
}
.rail:has(button:nth-child(2):hover) { --i: 1; }
.rail:has(button:nth-child(3):hover) { --i: 2; }
.rail button {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 43

# Kinetic XY Pad

Pattern 43 of 51 · Interaction and Input Skills

A two-axis puck trails the pointer, then springs home

Source readout: `x/y · pointer spring`

## Original AI prompt

```text
Create a compact two-axis input pad with a luminous puck. While dragging, map pointer coordinates to clamped X and Y values and move the puck with a short trailing transition. On release, spring it back to dead centre and reset a monospaced coordinate readout.
```

## Original CSS

```css
.xy-puck {
  translate: calc(var(--x) * 1px) calc(var(--y) * 1px);
  transition: translate .52s cubic-bezier(.34,1.56,.64,1);
}
.xy-pad.dragging .xy-puck { transition-duration: 70ms; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 44

# Command Palette Bloom

Pattern 44 of 51 · Interaction and Input Skills

A compact trigger unfolds into a staggered action lens

Source readout: `command · stagger`

## Original AI prompt

```text
Build a miniature command palette that blooms downward from a compact keyboard-shortcut trigger. Reveal a frosted action lens with a rounded clip-path wipe, then stagger three rows upward by a few pixels. Let Escape and outside clicks close it, and expose the expanded state to assistive technology.
```

## Original CSS

```css
.command-panel {
  clip-path: inset(0 0 100% 0 round 14px);
  transition: clip-path .5s cubic-bezier(.16,1,.3,1);
}
.command.open .command-panel { clip-path: inset(0 round 14px); }
.command.open .command-panel button { opacity: 1; transform: translateY(0); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 45

# Momentum Picker

Pattern 45 of 51 · Interaction and Input Skills

Wheel input rolls a weighted selector into its next detent

Source readout: `wheel · weighted snap`

## Original AI prompt

```text
Create a tactile vertical picker with three density options. Mouse-wheel, arrow keys, and taps should move one detent at a time; the list overshoots slightly while the focused row stays aligned behind a fixed highlight. Dim and scale peripheral rows to imply cylindrical depth.
```

## Original CSS

```css
.picker-track {
  transform: translateY(calc(var(--i) * -38px));
  transition: transform .58s cubic-bezier(.34,1.56,.64,1);
}
.picker-track button:not(.active) { opacity: .32; transform: scale(.88); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 46

# Prompt Composer

Pattern 46 of 51 · Interaction and Input Skills

An AI input grows with the thought, then commits to a run

Source readout: `compose · grow + bloom`

## Original AI prompt

```text
Build an AI prompt composer that feels alive as you type. The field auto-grows to its content with a glide easing instead of jumping line by line, a slow conic halo rotates behind the border only while focused, and the send button springs from a dim disabled dot to a full accent circle the moment there is text. On submit, morph the arrow into a stop square, run a determinate sweep across the field, then settle back to empty — no spinners, no layout shift.
```

## Original CSS

```css
.composer-field {
  transition: height .34s cubic-bezier(.16,1,.3,1), border-color .3s ease;
}
.composer-halo { opacity: 0; transition: opacity .45s ease; }
.composer.focused .composer-halo { opacity: 1; animation: halo-spin 4s linear infinite; }
.composer-send { transform: scale(.7); opacity: .35; }
.composer.ready .composer-send { transform: scale(1); opacity: 1; }
.composer.sending .composer-send::before { opacity: 0; }   /* arrow out */
.composer.sending .composer-send::after  { transform: scale(1); } /* stop square in */
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 47

# Filmstrip Scrubber

Pattern 47 of 51 · Interaction and Input Skills

A playhead snaps to the frame nearest the pointer

Source readout: `scrub · snap(0.48s)`

## Original AI prompt

```text
Create a video-style filmstrip scrubber. While the pointer moves across the strip, the playhead tracks it almost instantly and each frame swells based on how close it is to the cursor. On release or click, the playhead springs to the centre of the nearest frame and a monospaced timecode updates to that frame. Arrow keys should step frame by frame with the same spring, and the whole thing must stay one row with no reflow.
```

## Original CSS

```css
.filmstrip-head {
  translate: calc(var(--head) * 1px) 0;   /* --head is measured, not stepped */
  transition: translate .48s cubic-bezier(.34,1.56,.64,1);
}
.filmstrip.scrubbing .filmstrip-head { transition-duration: 90ms; }
.filmstrip-track button {
  transform: scaleY(calc(1 + var(--near) * .34));
  transition: transform .3s cubic-bezier(.34,1.56,.64,1), background .25s ease;
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 48

# Drag Stack Collect

Pattern 48 of 51 · Interaction and Input Skills

Loose items gather into a fanned pile under the pointer

Source readout: `gather(3) · fan 5°`

## Original AI prompt

```text
Build a Finder-style drag collection. Press on any item in a row and every item converges into a single fanned pile that follows the pointer, each card rotated a few degrees and stacked with a slight z-offset, with a count badge popping in beside them. Track the pointer with a short transition while dragging, and on release let all items spring back to their original slots on a stagger. Never reflow the row — the movement is transform-only.
```

## Original CSS

```css
.dragstack-row button {
  transition: translate .5s cubic-bezier(.34,1.56,.64,1), rotate .5s var(--spring);
}
.dragstack.gathered button {
  translate: calc(var(--dx) * 1px) calc(var(--dy) * 1px);
  rotate: calc(var(--i) * 5deg - 5deg);
  transition-duration: 120ms;              /* tight while dragging */
}
.dragstack.gathered .dragstack-badge { transform: scale(1); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 49

# Focus Relay

Pattern 49 of 51 · Interaction and Input Skills

A shared focus ring leaps between fields with a spring morph

Source readout: `focus · morph 0.48s`

## Original AI prompt

```text
Build a shared focus ring that is a single absolutely positioned element, not a per-field outline. Measure the active field and write --x --y --w --h onto the host. The ring springs to the new box with a cubic-bezier overshoot so the leap reads as one object relocating, not two outlines fading. Hover and keyboard focus must share the same path. Never reflow the fields.
```

## Original CSS

```css
.focus-ring {
  position: absolute;
  width: var(--w); height: var(--h);
  translate: var(--x) var(--y);
  border: 1.5px solid var(--amber);
  transition: translate .48s cubic-bezier(.34,1.56,.64,1),
              width .48s cubic-bezier(.34,1.56,.64,1),
              height .48s cubic-bezier(.34,1.56,.64,1);
  pointer-events: none;
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 50

# Hold to Talk

Pattern 50 of 51 · Interaction and Input Skills

A live waveform blooms while you hold, then commits on release

Source readout: `hold · waveform`

## Original AI prompt

```text
Create a hold-to-talk control. Idle bars sit almost flat. On press they spring up into a staggered live waveform and a ring blooms around the button. On release the bars collapse with a spring, the button flashes SENT for a beat, then everything returns to rest. This is a voice capture, not a confirm-hold ring — the waveform is the state.
```

## Original CSS

```css
.talk-wave i {
  transform: scaleY(0.12);
  transition: transform .4s cubic-bezier(.34,1.56,.64,1);
}
.talk.live .talk-wave i {
  animation: talk-bar .42s ease-in-out infinite alternate;
}
.talk.live .talk-wave i:nth-child(3) { animation-duration: .28s; }
@keyframes talk-bar {
  from { transform: scaleY(0.18); }
  to   { transform: scaleY(1); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 51

# Lattice Snap

Pattern 51 of 51 · Interaction and Input Skills

A tile follows the pointer, then springs onto the nearest cell

Source readout: `lattice · snap 0.5s`

## Original AI prompt

```text
Build a 3 by 2 magnetic lattice. While dragging, the tile tracks the pointer with a short trail and the cell under it lights. On release it springs to that cell using column and row custom properties — 100% of the tile size plus the gap — so the same rule works for every slot. Arrow keys should step one cell. Never reflow the grid.
```

## Original CSS

```css
.lattice-tile {
  translate: calc(var(--c) * (100% + 8px))
             calc(var(--r) * (100% + 8px));
  transition: translate .5s cubic-bezier(.34,1.56,.64,1);
}
.lattice.dragging .lattice-tile {
  translate: calc(var(--tx) * 1px) calc(var(--ty) * 1px);
  transition-duration: 80ms;
}
.lattice span.hot { border-color: var(--amber); background: rgba(255,138,0,.08); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.

