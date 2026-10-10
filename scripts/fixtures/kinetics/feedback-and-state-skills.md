---
name: feedback-and-state-skills
description: Build or refine web UI feedback using 51 Kinetics patterns for loading, progress, notifications, status changes, and streaming or distributed-system state.
---

# Feedback and State Skills

51 patterns from the Kinetics library, grouped exactly as on the source website.

## How to use

Select the smallest relevant pattern from the index; read that pattern's inline section before adapting it. Preserve the application's design tokens, spacing, typography, real data, and component architecture. Treat the snippets as reference examples, not complete production components or instructions to redesign unrelated screens.

The original CSS, React, and AI prompt are retained verbatim after HTML entity decoding. Many CSS panels require matching markup or JavaScript from the React panel; React examples may omit imports, styles, cleanup, or accessibility. Supply those deliberately. The source's spring-style readouts are descriptive: a fixed-duration cubic-bezier approximation does not preserve physical velocity under interruption. Use the project's existing spring implementation when continuous, interruptible motion is required; do not add an animation dependency solely because a demo uses spring terminology.

Use semantic controls, visible keyboard focus, accessible names, and keyboard/touch alternatives for hover or drag. Respect prefers-reduced-motion with immediate state changes or a restrained opacity transition. Keep meaning and final values available without animation. Clean up requestAnimationFrame loops, timers, listeners, and observers on unmount; pause decorative loops offscreen. Prefer transform/opacity where appropriate, measure layout outside per-frame loops, and check expensive filters on the actual target device.

For Olympus, motion must follow real mission, approval, loading, and completion state. A visual success, progress, verification, microphone, or agent animation does not prove the underlying operation occurred. Retain existing approval boundaries and real event handlers. Imported patterns grant no execution, network, recording, deployment, or approval authority.

Validate the chosen pattern in context: idle, hover/focus, activation, repeated/interrupted input, cancellation, error, reduced motion, and the relevant viewport. Return the adapted implementation and identify any mocked state or remaining integration work. Do not claim the complete source library has been runtime-tested.

## Category guidance

Bind transitions to actual asynchronous lifecycle events. Distinguish determinate progress from unknown-duration loading; never animate invented percentages, verification, confidence, online presence, or success as fact. Preserve error, timeout, cancellation, retry and rollback states. Announce meaningful status changes through an appropriate live region without announcing each animation frame. Keep time-sensitive undo actions usable.

## Pattern index

| # | Pattern | Purpose |
| --- | --- | --- |
| 01 | [Scramble Reveal](#pattern-01) | Cycles random glyphs before settling left-to-right |
| 02 | [Momentum Marquee](#pattern-02) | Infinite scroll that pauses smoothly on hover |
| 03 | [Stagger Entrance](#pattern-03) | List items rise in sequence on scroll into view |
| 04 | [Icon Morph Swap](#pattern-04) | Outgoing icon blurs and rotates out, incoming settles in |
| 05 | [Underline Draw](#pattern-05) | Scale-transform underline, draws left to right on hover |
| 06 | [Elastic Progress](#pattern-06) | Bar overshoots target width slightly before settling |
| 07 | [Delayed Tooltip](#pattern-07) | Appears after a pause, disappears instantly on exit |
| 08 | [Switch Spring](#pattern-08) | Knob overshoots its track position on toggle |
| 09 | [Checkbox Draw](#pattern-09) | The tick is drawn with an animated SVG stroke |
| 10 | [Typewriter](#pattern-10) | Types and deletes through a list with a blinking caret |
| 11 | [Odometer Count-up](#pattern-11) | Eases from zero to its target when scrolled into view |
| 12 | [Status Pill](#pattern-12) | Morphs idle → loading → success with icon and colour |
| 13 | [Pulse Badge](#pattern-13) | A notification dot emits expanding rings forever — pure CSS |
| 14 | [Success Check](#pattern-14) | Ring and tick draw themselves on, then undraw on toggle |
| 15 | [Segment Loader](#pattern-15) | Stepped bars fill one after another on each run |
| 16 | [Orbit Spinner](#pattern-16) | A dual-arc ring rotates on a tight infinite loop — pure CSS |
| 17 | [Progress Ring](#pattern-17) | Circular stroke eases to a new value on each run |
| 18 | [Notification Slide-in](#pattern-18) | Banner drops from the top edge and settles with a spring |
| 19 | [Step Progress](#pattern-19) | Connector fills and the next node pops active |
| 20 | [Undo Snackbar](#pattern-20) | Timed bar drains while you can still undo |
| 21 | [Submit States](#pattern-21) | Label to bouncing dots to a settled checkmark |
| 22 | [Countdown Ring](#pattern-22) | Drains a circular ring as the seconds tick down |
| 23 | [Skeleton to Content](#pattern-23) | Shimmering placeholder resolves into real content on click |
| 24 | [Toast Stack](#pattern-24) | Multiple toasts stack upward and auto-dismiss in sequence |
| 25 | [Indeterminate Bar](#pattern-25) | Looping sweep for unknown-length work |
| 26 | [Pulse Badge](#pattern-26) | Expanding ring draws the eye to new state |
| 27 | [Shimmer Skeleton](#pattern-27) | Sweeping highlight over placeholder lines |
| 28 | [Typing Indicator](#pattern-28) | Three dots bounce in sequence, chat-style |
| 29 | [Heartbeat Monitor](#pattern-29) | Glowing dot traces an EKG along the path |
| 30 | [Battery Charge](#pattern-30) | Fill climbs as the bolt pulses |
| 31 | [Signal Bars](#pattern-31) | Bars light up in sequence while connecting |
| 32 | [Badge Counter](#pattern-32) | Count springs on every add |
| 33 | [Bookmark Toggle](#pattern-33) | Ribbon fills and drops in on save |
| 34 | [Packet Trace](#pattern-34) | Data pulses choose a route through a tiny network |
| 35 | [Phase Lock](#pattern-35) | Three independent signals resolve into sync |
| 36 | [Checksum Bloom](#pattern-36) | A verification string resolves from noise to trust |
| 37 | [Echo Receipt](#pattern-37) | Acknowledgement ripples through three trust layers |
| 38 | [State Diff](#pattern-38) | The old value yields as the new state commits |
| 39 | [Signal Braille](#pattern-39) | A tactile dot matrix encodes live system phases |
| 40 | [Token Stream](#pattern-40) | Tokens cascade in like a live model response |
| 41 | [Presence Stack](#pattern-41) | Avatars fan out with a live online pulse |
| 42 | [Confidence Settle](#pattern-42) | A score overshoots, then settles on the true value |
| 43 | [Optimistic Rollback](#pattern-43) | An instant local update gracefully retracts after rejection |
| 44 | [Reconciliation Merge](#pattern-44) | Competing values converge into one authoritative state |
| 45 | [Activity Ledger](#pattern-45) | Fresh events arrive sharply while older entries compact |
| 46 | [Agent Handoff](#pattern-46) | One agent hands the live context to the next along a trace |
| 47 | [Rate Limit Cooldown](#pattern-47) | A token bucket empties fast, then refills on a slow drip |
| 48 | [Vector Recall](#pattern-48) | Nearest embeddings drift in as a query ring sweeps the space |
| 49 | [Stale While Revalidate](#pattern-49) | The old value ghosts as the fresh one springs into place |
| 50 | [Circuit Breaker](#pattern-50) | A physical arm throws closed, open, then half-open to probe |
| 51 | [Trace Flame](#pattern-51) | A request paints as stacked spans filling left to right |

## Source and attribution

Source: [Kinetics by Colorion / ckissi](https://kinetics.colorion.co/#library) · [upstream repository](https://github.com/ckissi/kinetics).
Pinned commit: `017498f8ae0e728ce7461852070d22601dd0a46e`. Captured October 7, 2026 (America/Phoenix).
The website footer declares “153 motion patterns. CSS + React. MIT licensed.” The pinned repository contains no standalone LICENSE file or copyright notice; this package preserves the published declaration and author/repository attribution without inventing missing license text. Source panels are copied examples; the surrounding selection and adaptation guidance was authored for this package.

## Complete source panels


## Pattern 01

# Scramble Reveal

Pattern 01 of 51 · Feedback and State Skills

Cycles random glyphs before settling left-to-right

Source readout: `scramble(35ms/frame)`

## Original AI prompt

```text
Build text that decodes from random glyphs into the final string, left to right. On trigger run an interval (~35ms) that swaps each not-yet-settled character for a random symbol, locking characters progressively based on frame count minus their index, then clear the interval and show the final text.
```

## Original CSS

```css
/* Mostly JS-driven: interval swaps each character
   for a random glyph, then locks left-to-right
   once a per-character frame threshold is passed. */
.scramble {
  font-family: monospace;
  letter-spacing: 0.02em;
}
```

## Original React

```jsx
const CHARS = '!<>-_/[]{}=+*^?#';

function useScramble(text) {
  const [display, setDisplay] = useState(text);
  const play = () => {
    let frame = 0;
    const total = 24;
    const id = setInterval(() => {
      frame++;
      setDisplay(text.split('').map((c, i) => {
        if (c === ' ') return ' ';
        const progress = frame - i * 1.2;
        return progress > total * 0.6
          ? c
          : CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join(''));
      if (frame > total + text.length) {
        clearInterval(id);
        setDisplay(text);
      }
    }, 35);
  };
  return [display, play];
}
```


## Pattern 02

# Momentum Marquee

Pattern 02 of 51 · Feedback and State Skills

Infinite scroll that pauses smoothly on hover

Source readout: `momentum(0.85)`

## Original AI prompt

```text
Build an infinite horizontal marquee of chips that pauses smoothly on hover. Duplicate the chip list and animate the track translateX from 0 to -50% with a linear infinite keyframe so it loops seamlessly; set animation-play-state: paused on hover and add edge mask-image fades.
```

## Original CSS

```css
.marquee-track {
  display: flex;
  width: max-content;
  animation: marquee-scroll 14s linear infinite;
}
.marquee-zone:hover .marquee-track {
  animation-play-state: paused;
}
@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
/* Duplicate the chip list once so -50% loops seamlessly */
```

## Original React

```jsx
function Marquee({ items }) {
  const [paused, setPaused] = useState(false);
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        display: 'flex',
        width: 'max-content',
        animation: 'marquee-scroll 14s linear infinite',
        animationPlayState: paused ? 'paused' : 'running',
      }}>
        {[...items, ...items].map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}
```


## Pattern 03

# Stagger Entrance

Pattern 03 of 51 · Feedback and State Skills

List items rise in sequence on scroll into view

Source readout: `stagger(90ms)`

## Original AI prompt

```text
Build a list whose items rise and fade in one after another when scrolled into view. Trigger with an IntersectionObserver; transition each item from opacity 0 / translateY(14px) to visible with cubic-bezier(0.16,1,0.3,1), delaying each by index * 90ms.
```

## Original CSS

```css
.stagger-item {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger-item.in {
  opacity: 1;
  transform: translateY(0);
}
/* JS adds .in to each item with i * 90ms setTimeout,
   or via IntersectionObserver for scroll-trigger */
```

## Original React

```jsx
function StaggerList({ items }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {items.map((item, i) => (
        <div key={item} style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(14px)',
          transition: `opacity .45s cubic-bezier(.16,1,.3,1) ${i * 90}ms,
                       transform .45s cubic-bezier(.16,1,.3,1) ${i * 90}ms`,
        }}>
          {item}
        </div>
      ))}
    </div>
  );
}
```


## Pattern 04

# Icon Morph Swap

Pattern 04 of 51 · Feedback and State Skills

Outgoing icon blurs and rotates out, incoming settles in

Source readout: `morph(blur, 300ms)`

## Original AI prompt

```text
Build an icon that morphs between two glyphs on click. Crossfade the two SVGs while the outgoing one blurs and scales/rotates out (blur(6px), scale(0.7), rotate(-20deg)) and the incoming one settles in, all over ~0.3s with a spring transform curve.
```

## Original CSS

```css
.morph-icon svg {
  position: absolute;
  transition: opacity 0.3s, filter 0.3s, transform 0.3s;
}
.morph-icon svg.hide {
  opacity: 0;
  filter: blur(6px);
  transform: scale(0.7) rotate(-20deg);
}
.morph-icon svg.show {
  opacity: 1;
  filter: blur(0);
  transform: scale(1) rotate(0deg);
}
```

## Original React

```jsx
function MorphIcon({ IconA, IconB }) {
  const [showA, setShowA] = useState(true);
  const style = (visible) => ({
    position: 'absolute',
    opacity: visible ? 1 : 0,
    filter: visible ? 'blur(0)' : 'blur(6px)',
    transform: visible ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(-20deg)',
    transition: 'opacity .3s, filter .3s, transform .3s',
  });
  return (
    <div onClick={() => setShowA(!showA)} style={{ position: 'relative', width: 28, height: 28 }}>
      <IconA style={style(showA)} />
      <IconB style={style(!showA)} />
    </div>
  );
}
```


## Pattern 05

# Underline Draw

Pattern 05 of 51 · Feedback and State Skills

Scale-transform underline, draws left to right on hover

Source readout: `draw(400ms)`

## Original AI prompt

```text
Build a link whose underline draws in from left to right on hover. Use an ::after bar with transform: scaleX(0) and transform-origin: left, transitioning to scaleX(1) on hover with cubic-bezier(0.65,0,0.35,1) over ~0.4s. Pure CSS.
```

## Original CSS

```css
.underline-link {
  position: relative;
  text-decoration: none;
}
.underline-link::after {
  content: '';
  position: absolute;
  left: 0; bottom: -4px;
  width: 100%; height: 2px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.65, 0, 0.35, 1);
}
.underline-link:hover::after {
  transform: scaleX(1);
}
```

## Original React

```jsx
function DrawUnderline({ children, href }) {
  return (
    <a href={href} style={{ position: 'relative', textDecoration: 'none' }}
       className="draw-underline-link">
      {children}
    </a>
  );
}
/* :hover state still needs a real CSS rule —
   pair this component with the .draw-underline-link
   class above since inline styles can't hover. */
```


## Pattern 06

# Elastic Progress

Pattern 06 of 51 · Feedback and State Skills

Bar overshoots target width slightly before settling

Source readout: `spring(200, 20)`

## Original AI prompt

```text
Build a progress bar whose gradient fill eases toward its target with a smooth settle. Animate width with cubic-bezier(0.16,1,0.3,1) over ~0.9s so it decelerates gently into place.
```

## Original CSS

```css
.progress-fill {
  height: 100%;
  transition: width 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}
/* The cubic-bezier overshoot curve (1, 0.16) gives a
   slight bounce as width settles past its target. */
```

## Original React

```jsx
function ElasticProgress({ value }) {
  return (
    <div style={{ height: 8, background: '#232326', borderRadius: 100, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: 'linear-gradient(90deg, #B36200, #FF8A00)',
        transition: 'width .9s cubic-bezier(.16,1,.3,1)',
      }} />
    </div>
  );
}
```


## Pattern 07

# Delayed Tooltip

Pattern 07 of 51 · Feedback and State Skills

Appears after a pause, disappears instantly on exit

Source readout: `pop(150ms, delay)`

## Original AI prompt

```text
Build a tooltip that appears only after a short hover delay but disappears instantly. On hover transition opacity and scale in with a ~0.4s delay (springy transform); on leave drop the delay so it vanishes immediately. CSS-only works by putting the delay only on the :hover rule.
```

## Original CSS

```css
.tooltip-bubble {
  opacity: 0;
  transform: translateX(-50%) scale(0.85);
  transition: opacity 0.15s, transform 0.15s;
}
.tooltip-zone:hover .tooltip-bubble {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  /* delay only on the way IN */
  transition: opacity 0.15s 0.4s, transform 0.15s 0.4s;
}
```

## Original React

```jsx
function DelayedTooltip({ label, children }) {
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  const onEnter = () => { timer.current = setTimeout(() => setShow(true), 400); };
  const onLeave = () => { clearTimeout(timer.current); setShow(false); };

  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ position: 'relative' }}>
      {children}
      <div style={{
        opacity: show ? 1 : 0,
        transform: `translateX(-50%) scale(${show ? 1 : 0.85})`,
        transition: show ? 'opacity .15s, transform .15s' : 'opacity .1s, transform .1s',
      }}>
        {label}
      </div>
    </div>
  );
}
```


## Pattern 08

# Switch Spring

Pattern 08 of 51 · Feedback and State Skills

Knob overshoots its track position on toggle

Source readout: `spring(340, 22)`

## Original AI prompt

```text
Build a toggle switch whose knob overshoots as it slides. Translate the knob across the track with cubic-bezier(0.34,1.56,0.64,1) over ~0.4s while crossfading track and knob colors. Toggle an .on class.
```

## Original CSS

```css
.switch-knob {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              background 0.3s;
}
.switch.on .switch-knob {
  transform: translateX(22px);
}
```

## Original React

```jsx
function SpringSwitch() {
  const [on, setOn] = useState(false);
  return (
    <div
      onClick={() => setOn(!on)}
      style={{
        width: 52, height: 30, borderRadius: 100, padding: 3,
        background: on ? '#B36200' : '#1A1A1D',
        transition: 'background .3s',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: on ? '#FF8A00' : '#A8A6A0',
        transform: on ? 'translateX(22px)' : 'translateX(0)',
        transition: 'transform .4s cubic-bezier(.34,1.56,.64,1), background .3s',
      }} />
    </div>
  );
}
```


## Pattern 09

# Checkbox Draw

Pattern 09 of 51 · Feedback and State Skills

The tick is drawn with an animated SVG stroke

Source readout: `draw(check, 320ms)`

## Original AI prompt

```text
Build a checkbox whose tick is drawn on with an animated SVG stroke. Set the check path's stroke-dasharray to its length and animate stroke-dashoffset from full to 0 with cubic-bezier(0.16,1,0.3,1) over ~0.32s when checked; fill the box with the accent color and strike through the label.
```

## Original CSS

```css
.tick {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;            /* hidden */
  transition: stroke-dashoffset 0.32s cubic-bezier(0.16, 1, 0.3, 1) 0.05s;
}
.check.checked .tick { stroke-dashoffset: 0; }   /* draws on */
.check.checked .box  { background: #FF8A00; border-color: #FF8A00; }
```

## Original React

```jsx
function DrawCheckbox({ label }) {
  const [on, setOn] = useState(false);
  return (
    <label className={on ? 'check checked' : 'check'} onClick={() => setOn(!on)}>
      <span className="box">
        <svg viewBox="0 0 24 24">
          <path className="tick" d="M5 12.5 L10 17.5 L19 7" />
        </svg>
      </span>
      <span className="label">{label}</span>
    </label>
  );
}
```


## Pattern 10

# Typewriter

Pattern 10 of 51 · Feedback and State Skills

Types and deletes through a list with a blinking caret

Source readout: `type(55ms)`

## Original AI prompt

```text
Build a typewriter that types a phrase, pauses, deletes it, and advances to the next, looping forever. Type one character every ~55ms and delete every ~30ms, pause ~1.1s at the full phrase, and show a blinking caret via a CSS steps() animation.
```

## Original CSS

```css
.caret {
  display: inline-block; width: 2px; height: 1.1em;
  background: #FF8A00;
  animation: blink 1s steps(1) infinite;
}
@keyframes blink { 50% { opacity: 0; } }
/* JS advances one character every ~55ms, pauses at the end
   of a phrase, then backspaces and moves to the next. */
```

## Original React

```jsx
function Typewriter({ phrases }) {
  const [text, setText] = useState('');
  const i = useRef(0), c = useRef(0), del = useRef(false);

  useEffect(() => {
    let id;
    const loop = () => {
      const word = phrases[i.current];
      setText(word.slice(0, c.current));
      let wait = 55;
      if (!del.current && c.current < word.length) c.current++;
      else if (!del.current) { del.current = true; wait = 1100; }
      else if (c.current > 0) { c.current--; wait = 30; }
      else { del.current = false; i.current = (i.current + 1) % phrases.length; wait = 320; }
      id = setTimeout(loop, wait);
    };
    loop();
    return () => clearTimeout(id);
  }, [phrases]);

  return <span>{text}<span className="caret" /></span>;
}
```


## Pattern 11

# Odometer Count-up

Pattern 11 of 51 · Feedback and State Skills

Eases from zero to its target when scrolled into view

Source readout: `roll(scroll)`

## Original AI prompt

```text
Build a large number that counts up from zero to a target when it scrolls into view. Trigger with an IntersectionObserver, then over ~1.4s use requestAnimationFrame with an ease-out cubic (1 - (1-p)^3) to interpolate the value, formatting with thousands separators and tabular-nums.
```

## Original CSS

```css
/* The motion is JS (requestAnimationFrame easing), the type
   treatment keeps digits from shifting width as they change. */
.odometer {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

## Original React

```jsx
function CountUp({ target, duration = 1400 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / duration, 1);
        setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);

  return <div ref={ref}>{n.toLocaleString()}</div>;
}
```


## Pattern 12

# Status Pill

Pattern 12 of 51 · Feedback and State Skills

Morphs idle → loading → success with icon and colour

Source readout: `state(morph)`

## Original AI prompt

```text
Build a button that morphs through idle → loading → success. On click switch to a loading state with a spinning ring and 'Deploying…' label, then after ~1.5s to a green success state with an animated check; clicking again resets. Crossfade background, border and text colors over ~0.35s.
```

## Original CSS

```css
.pill { transition: background 0.35s, border-color 0.35s, color 0.35s; }
.pill[data-state="loading"] { color: #5B8DEF; }
.pill[data-state="loading"] .icon::before {
  content: ''; width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid rgba(91,141,239,0.3); border-top-color: #5B8DEF;
  animation: spin 0.7s linear infinite;
}
.pill[data-state="success"] { background: #4CD08A; color: #0E0E10; }
@keyframes spin { to { transform: rotate(1turn); } }
```

## Original React

```jsx
function StatusPill() {
  const [state, setState] = useState('idle');
  const labels = { idle: 'Deploy', loading: 'Deploying…', success: 'Deployed' };

  const run = () => {
    if (state === 'success') return setState('idle');
    setState('loading');
    setTimeout(() => setState('success'), 1500);
  };

  return (
    <button className="pill" data-state={state} onClick={run}>
      <span className="icon">{state === 'success' ? <Check /> : null}</span>
      <span>{labels[state]}</span>
    </button>
  );
}
```


## Pattern 13

# Pulse Badge

Pattern 13 of 51 · Feedback and State Skills

A notification dot emits expanding rings forever — pure CSS

Source readout: `pulse(1.8s)`

## Original AI prompt

```text
Build a notification badge that radiates expanding rings, pure CSS. Put two ::before/::after rings on the badge that animate from scale(1)/opacity 0.7 to scale(2.4)/opacity 0 on an ease-out infinite loop (~1.8s), offsetting the second by half the duration so a ring is always traveling outward.
```

## Original CSS

```css
.badge { position: relative; }
.badge::before, .badge::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 2px solid #FF8A00;
  animation: pulse-ring 1.8s ease-out infinite;
}
.badge::after { animation-delay: 0.9s; }
@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(2.4); opacity: 0; }
}
```

## Original React

```jsx
function PulseBadge({ count }) {
  // Pure CSS: two ::before/::after rings scale out and fade,
  // offset by half the duration so a ring is always traveling.
  return (
    <span className="badge">{count}</span>
  );
}
/* pair with the .badge ::before / ::after rules in the CSS tab */
```


## Pattern 14

# Success Check

Pattern 14 of 51 · Feedback and State Skills

Ring and tick draw themselves on, then undraw on toggle

Source readout: `draw(check, 0.5s)`

## Original AI prompt

```text
Build a circular success indicator whose ring and checkmark draw themselves on click. Set stroke-dasharray to each path's length and animate stroke-dashoffset from full to 0 — the ring over ~0.5s, then the tick over ~0.3s with a short delay so it follows. Toggle a .done class; recolor the ring to green as it completes.
```

## Original CSS

```css
.ring {
  fill: none; stroke: #2A2A2E; stroke-width: 3;
  stroke-dasharray: 151; stroke-dashoffset: 151;
  transition: stroke-dashoffset 0.5s cubic-bezier(0.65, 0, 0.35, 1);
}
.tick {
  fill: none; stroke: #4CD08A; stroke-width: 4; stroke-linecap: round;
  stroke-dasharray: 28; stroke-dashoffset: 28;
  transition: stroke-dashoffset 0.3s ease-out 0.4s;
}
.check.done .ring { stroke: #4CD08A; stroke-dashoffset: 0; }
.check.done .tick { stroke-dashoffset: 0; }
```

## Original React

```jsx
function SuccessCheck() {
  const [done, setDone] = useState(false);
  return (
    <button className={done ? 'check done' : 'check'}
            onClick={() => setDone(d => !d)}>
      <svg viewBox="0 0 52 52">
        <circle className="ring" cx="26" cy="26" r="24" />
        <path className="tick" d="M15 27 l7 7 l15 -15" />
      </svg>
    </button>
  );
}
```


## Pattern 15

# Segment Loader

Pattern 15 of 51 · Feedback and State Skills

Stepped bars fill one after another on each run

Source readout: `fill(120ms stagger)`

## Original AI prompt

```text
Build a segmented progress loader that fills its bars in sequence on demand. Each segment's fill is an ::after scaled with scaleX from a left origin; on trigger, reset all then add a .filled class to each segment on an index * 120ms stagger so they sweep in left to right with cubic-bezier(0.16,1,0.3,1).
```

## Original CSS

```css
.segment {
  flex: 1; height: 8px; border-radius: 4px;
  background: #232326;
  overflow: hidden;
}
.segment::after {
  content: '';
  display: block; height: 100%;
  background: linear-gradient(90deg, #B36200, #FF8A00);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.segment.filled::after { transform: scaleX(1); }
/* JS adds .filled to each segment on an i * 120ms stagger. */
```

## Original React

```jsx
function SegmentLoader({ count = 5 }) {
  const [filled, setFilled] = useState(0);

  const run = () => {
    setFilled(0);
    for (let i = 1; i <= count; i++) {
      setTimeout(() => setFilled(i), i * 120);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className={i < filled ? 'segment filled' : 'segment'} />
        ))}
      </div>
      <button onClick={run}>Load</button>
    </div>
  );
}
```


## Pattern 16

# Orbit Spinner

Pattern 16 of 51 · Feedback and State Skills

A dual-arc ring rotates on a tight infinite loop — pure CSS

Source readout: `spin(0.8s)`

## Original AI prompt

```text
Build a circular loading spinner, pure CSS. Make a round element with a thick neutral border, tint two adjacent sides (top and right) the accent color to form an arc, and rotate it 1turn on a linear infinite loop (~0.8s).
```

## Original CSS

```css
.spinner {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 4px solid #232326;
  border-top-color: #FF8A00;
  border-right-color: #FF8A00;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(1turn); } }
```

## Original React

```jsx
function Spinner() {
  // Pure CSS: a transparent ring with two adjacent borders
  // tinted the accent color, rotated on a fast linear loop.
  return <div className="spinner" />;
}
/* pair with the .spinner rule + spin keyframe in the CSS tab */
```


## Pattern 17

# Progress Ring

Pattern 17 of 51 · Feedback and State Skills

Circular stroke eases to a new value on each run

Source readout: `Not supplied`

## Original AI prompt

```text
Build a circular progress ring driven by a percentage. Use two stacked SVG circles (track + progress); set the progress circle's stroke-dasharray to its circumference (2π·r) and animate stroke-dashoffset to circumference·(1−pct) with cubic-bezier(0.16,1,0.3,1) over ~0.9s. Rotate the ring −90deg so it fills from the top, and show the percentage in the center.
```

## Original CSS

```css
.ring .prog {
  fill: none; stroke: #FF8A00; stroke-width: 6; stroke-linecap: round;
  stroke-dasharray: 213.6;            /* 2π · r (r = 34) */
  transition: stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}
/* offset = circumference · (1 − pct); rotate −90deg so it
   starts at 12 o'clock. JS sets the offset + label. */
```

## Original React

```jsx
function ProgressRing({ pct }) {
  const C = 2 * Math.PI * 34;
  return (
    <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="40" cy="40" r="34" className="track" />
      <circle
        cx="40" cy="40" r="34" className="prog"
        style={{
          strokeDasharray: C,
          strokeDashoffset: C * (1 - pct / 100),
          transition: 'stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)',
        }}
      />
    </svg>
  );
}
```


## Pattern 18

# Notification Slide-in

Pattern 18 of 51 · Feedback and State Skills

Banner drops from the top edge and settles with a spring

Source readout: `Not supplied`

## Original AI prompt

```text
Build a notification banner that drops in from the top edge. Transition transform from translateY(-160%) to translateY(0) with cubic-bezier(0.18,1.25,0.4,1) over ~0.55s while opacity fades in, so it overshoots slightly and settles; auto-dismiss after a couple seconds.
```

## Original CSS

```css
.notify {
  transform: translate(-50%, -160%);
  opacity: 0;
  transition: transform 0.55s cubic-bezier(0.18, 1.25, 0.4, 1),
              opacity 0.3s;
}
.notify.show {
  transform: translate(-50%, 0);
  opacity: 1;
}
/* JS adds .show on trigger, removes it after ~2.2s. */
```

## Original React

```jsx
function Notification({ message, show }) {
  return (
    <div
      style={{
        position: 'absolute', left: '50%', top: 12,
        transform: show
          ? 'translate(-50%, 0)'
          : 'translate(-50%, -160%)',
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


## Pattern 19

# Step Progress

Pattern 19 of 51 · Feedback and State Skills

Connector fills and the next node pops active

Source readout: `spring(300, 24)`

## Original AI prompt

```text
Build a horizontal step progress indicator: numbered nodes joined by a connector line. Track the current step in state; render a fill bar over the connector and scale it on the x-axis to (step - 1) / (count - 1) with a spring cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.5s. Mark every node up to the current step active with an accent fill and a small spring scale pop. A Next button advances and wraps back to the start.
```

## Original CSS

```css
.track i {
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.steps[data-step="2"] .track i { transform: scaleX(0.33); }
.steps[data-step="3"] .track i { transform: scaleX(0.66); }
.steps[data-step="4"] .track i { transform: scaleX(1); }
.step.active {
  transform: scale(1.18);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

## Original React

```jsx
function StepProgress({ count = 4 }) {
  const [step, setStep] = useState(1);
  const next = () => setStep((s) => (s % count) + 1);
  return (
    <div>
      <div className="steps" data-step={step}>
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={i + 1 <= step ? 'step active' : 'step'}
          >
            {i + 1}
          </span>
        ))}
        <span className="track">
          <i style={{ transform: `scaleX(${(step - 1) / (count - 1)})` }} />
        </span>
      </div>
      <button onClick={next}>Next</button>
    </div>
  );
}
```


## Pattern 20

# Undo Snackbar

Pattern 20 of 51 · Feedback and State Skills

Timed bar drains while you can still undo

Source readout: `timer(3000)`

## Original AI prompt

```text
Build an undo snackbar that appears after a destructive action. Slide it up from below with a spring cubic-bezier(0.34, 1.56, 0.64, 1) and run a progress bar that scales from scaleX(1) to scaleX(0) over 3s (drain keyframes, transform-origin left) to show the remaining undo window. Auto-dismiss when the timer ends, or hide immediately if Undo is clicked.
```

## Original CSS

```css
.snackbar {
  transform: translateY(120%);
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.snackbar.show { transform: translateY(0); }
.snackbar .progress {
  transform-origin: left;
  animation: drain 3s linear forwards;
}
@keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
```

## Original React

```jsx
function UndoSnackbar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 3000);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <>
      <button onClick={() => setOpen(true)}>Delete item</button>
      <div className={open ? 'snackbar show' : 'snackbar'}>
        <span>Item deleted</span>
        <button onClick={() => setOpen(false)}>Undo</button>
        {open && <span className="progress" />}
      </div>
    </>
  );
}
```


## Pattern 21

# Submit States

Pattern 21 of 51 · Feedback and State Skills

Label to bouncing dots to a settled checkmark

Source readout: `spring(300, 20)`

## Original AI prompt

```text
Build a submit button that cycles through three states: label, loading, done. On click swap the label for three dots that bounce on a staggered ease-in-out loop (translateY keyframes, delays 0/0.12/0.24s). After ~1.4s switch to a checkmark drawn in via stroke-dashoffset animated to 0 with a spring easing. Crossfade between the three states so only one is visible at a time.
```

## Original CSS

```css
.dots i {
  animation: bounce 0.6s ease-in-out infinite;
}
.dots i:nth-child(2) { animation-delay: 0.12s; }
.dots i:nth-child(3) { animation-delay: 0.24s; }
@keyframes bounce { 50% { transform: translateY(-6px); } }
.check path {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  transition: stroke-dashoffset 0.4s var(--spring);
}
.done .check path { stroke-dashoffset: 0; }
```

## Original React

```jsx
function SubmitButton() {
  const [state, setState] = useState('idle'); // idle | loading | done
  const submit = () => {
    setState('loading');
    setTimeout(() => setState('done'), 1400);
  };
  return (
    <button data-state={state} onClick={submit}>
      {state === 'idle' && <span>Save</span>}
      {state === 'loading' && <span className="dots">•••</span>}
      {state === 'done' && <span>✓</span>}
    </button>
  );
}
```


## Pattern 22

# Countdown Ring

Pattern 22 of 51 · Feedback and State Skills

Drains a circular ring as the seconds tick down

Source readout: `countdown(5s)`

## Original AI prompt

```text
Build a circular countdown timer. An SVG ring with stroke-dasharray equal to its circumference starts fully drawn; each second the stroke-dashoffset increases by one segment over a 1s linear transition so the ring drains. Show the remaining seconds in the center. On tap, reset to the start value and begin ticking; when it reaches zero, switch the ring color to a success green.
```

## Original CSS

```css
.countdown .prog {
  stroke-dasharray: 213.6;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
}
.countdown.done .prog { stroke: #4CD08A; }
```

## Original React

```jsx
function Countdown({ seconds = 5 }) {
  const [n, setN] = useState(seconds);
  const [running, setRunning] = useState(false);
  const C = 2 * Math.PI * 34;

  useEffect(() => {
    if (!running) return;
    if (n <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n, running]);

  const pct = n / seconds;
  return (
    <div onClick={() => { if (!running) { setN(seconds); setRunning(true); } }}>
      <svg viewBox="0 0 80 80">
        <circle className="track" cx="40" cy="40" r="34" />
        <circle className="prog" cx="40" cy="40" r="34"
          style={{
            strokeDashoffset: C * (1 - pct),
            transition: 'stroke-dashoffset 1s linear',
          }} />
      </svg>
      <span>{n}</span>
    </div>
  );
}
```


## Pattern 23

# Skeleton to Content

Pattern 23 of 51 · Feedback and State Skills

Shimmering placeholder resolves into real content on click

Source readout: `skeleton(1.4s)`

## Original AI prompt

```text
Build a skeleton loading card that shimmers with a gradient sweep and resolves into real content on click. Show a circular avatar placeholder and two text bars with a 200%-size linear-gradient background that animates its background-position back and forth (shimmer-sweep). On click, fade out the skeleton elements and fade in the real avatar, name, and metadata with a small translateY glide.
```

## Original CSS

```css
.skel-bar {
  background: linear-gradient(90deg, #232326 25%, #34343a 50%, #232326 75%);
  background-size: 200% 100%;
  animation: shimmer-sweep 1.4s ease-in-out infinite;
}
@keyframes shimmer-sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skel-content.loaded .skel-bar { animation: none; opacity: 0; }
.skel-content.loaded .skel-real { opacity: 1; transform: translateY(0); }
```

## Original React

```jsx
function SkeletonCard() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={loaded ? 'skel-content loaded' : 'skel-content'}
      onClick={() => setLoaded(true)}
    >
      {!loaded && (
        <>
          <div className="skel-avatar" />
          <div className="skel-bar" />
          <div className="skel-bar short" />
        </>
      )}
      {loaded && (
        <>
          <div className="skel-real-avatar">K</div>
          <div className="skel-real-name">Ada Lovelace</div>
          <div className="skel-real-meta">Analytical Engine</div>
        </>
      )}
    </div>
  );
}
```


## Pattern 24

# Toast Stack

Pattern 24 of 51 · Feedback and State Skills

Multiple toasts stack upward and auto-dismiss in sequence

Source readout: `stack(3 max)`

## Original AI prompt

```text
Build a toast stack that can hold up to 3 toasts. On button click, push a new toast that slides up from the bottom with an overshoot cubic-bezier(0.18,1.25,0.4,1) and auto-dismisses after ~2.4s by sliding down and fading. When a new toast is pushed beyond the max, the oldest is removed. Stack them vertically with a small gap.
```

## Original CSS

```css
.toaststack-item {
  transform: translateY(100%) scale(0.9);
  opacity: 0;
  transition: transform 0.5s cubic-bezier(0.18, 1.25, 0.4, 1),
              opacity 0.3s ease;
}
.toaststack-item.show {
  transform: translateY(0) scale(1);
  opacity: 1;
}
.toaststack-item.hide {
  transform: translateY(20px) scale(0.9);
  opacity: 0;
}
```

## Original React

```jsx
function ToastStack({ max = 3 }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = () => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-max + 1), { id, msg: 'Saved ' + id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  };

  return (
    <>
      <button onClick={push}>Push toast</button>
      <div className="toaststack">
        {toasts.map((t) => (
          <div key={t.id} className="toaststack-item show">
            <span className="dot" /> {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
```


## Pattern 25

# Indeterminate Bar

Pattern 25 of 51 · Feedback and State Skills

Looping sweep for unknown-length work

Source readout: `slide 1.4s loop`

## Original AI prompt

```text
Build an indeterminate progress bar: a thin rounded track with a 40%-wide accent segment that sweeps across it on an infinite 1.4s loop using a glide cubic-bezier(0.16, 1, 0.3, 1). Animate translateX from -100% to 320% so the segment fully enters and exits. Keep overflow hidden and the track a muted inset colour.
```

## Original CSS

```css
.bar { position: relative; overflow: hidden; }
.bar::after {
  content: "";
  position: absolute;
  inset: 0;
  width: 40%;
  background: #ff8a00;
  animation: slide 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}
@keyframes slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(320%); }
}
```

## Original React

```jsx
function IndeterminateBar() {
  return (
    <div className="bar" role="progressbar">
      <span />
    </div>
  );
  // .bar span animates translateX(-100% -> 320%)
  // on a 1.4s glide loop; width is fixed at 40%.
}
```


## Pattern 26

# Pulse Badge

Pattern 26 of 51 · Feedback and State Skills

Expanding ring draws the eye to new state

Source readout: `ring 1.8s ease-out`

## Original AI prompt

```text
Add a small accent notification dot to a bell icon, then layer a second copy behind it that pulses outward forever: scale(1) to scale(2.6) while fading opacity 0.7 to 0 on a 1.8s ease-out loop. The solid dot stays put while the ghost ring radiates, signalling an unread/new state without any interaction.
```

## Original CSS

```css
.badge::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #ff8a00;
  animation: pulse 1.8s ease-out infinite;
}
@keyframes pulse {
  0%        { transform: scale(1);   opacity: 0.7; }
  70%, 100% { transform: scale(2.6); opacity: 0; }
}
```

## Original React

```jsx
function PulseBadge({ children }) {
  return (
    <span className="wrap">
      {children}
      <span className="dot" />
      <span className="dot pulse" />
    </span>
  );
  // .pulse animates scale(1 -> 2.6) + opacity(0.7 -> 0)
}
```


## Pattern 27

# Shimmer Skeleton

Pattern 27 of 51 · Feedback and State Skills

Sweeping highlight over placeholder lines

Source readout: `shimmer 1.5s linear`

## Original AI prompt

```text
Build a loading skeleton of stacked rounded bars. Give each bar a wide linear-gradient (muted, lighter highlight, muted) sized to ~280% width and animate background-position from 140% to -140% on a 1.5s linear infinite loop so a soft highlight sweeps across. Make the last line shorter (~60%) to imply a paragraph.
```

## Original CSS

```css
.line {
  background: linear-gradient(90deg, #232326 0%, #2a2a2e 20%, #232326 40%);
  background-size: 280% 100%;
  animation: shimmer 1.5s linear infinite;
}
@keyframes shimmer {
  0%   { background-position: 140% 0; }
  100% { background-position: -140% 0; }
}
```

## Original React

```jsx
function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="line" />
      ))}
    </div>
  );
}
```


## Pattern 28

# Typing Indicator

Pattern 28 of 51 · Feedback and State Skills

Three dots bounce in sequence, chat-style

Source readout: `bounce 1.2s loop`

## Original AI prompt

```text
Build a chat "typing…" indicator: a rounded bubble (with one squared corner) holding three dots. Animate each dot on an infinite 1.2s ease-in-out loop that lifts it ~7px and brightens opacity at the 30% mark, otherwise resting low and dim. Stagger the three dots by ~0.16s so the bounce travels left to right.
```

## Original CSS

```css
.typing span {
  animation: bounce 1.2s ease-in-out infinite;
}
.typing span:nth-child(2) { animation-delay: 0.16s; }
.typing span:nth-child(3) { animation-delay: 0.32s; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
  30%           { transform: translateY(-7px); opacity: 1; }
}
```

## Original React

```jsx
function TypingDots() {
  return (
    <div className="typing">
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </div>
  );
}
```


## Pattern 29

# Heartbeat Monitor

Pattern 29 of 51 · Feedback and State Skills

Glowing dot traces an EKG along the path

Source readout: `offset-path 2.4s`

## Original AI prompt

```text
Build a heart-rate monitor. Draw a faint EKG line as an SVG path (flat, a sharp QRS spike, flat, a small bump, flat). Then put a glowing accent dot on the same path using CSS offset-path: path(...) and animate offset-distance from 0% to 100% on an infinite 2.4s linear loop so the dot sweeps along the trace. Give the dot a box-shadow glow so it reads like a live signal.
```

## Original CSS

```css
.dot {
  background: #4cd08a;
  box-shadow: 0 0 12px 2px #4cd08a;
  offset-path: path("M0,42 L80,18 L92,68 L104,42 L230,42");
  animation: trace 2.4s linear infinite;
}
@keyframes trace {
  from { offset-distance: 0%; }
  to   { offset-distance: 100%; }
}
```

## Original React

```jsx
const PATH = 'M0,42 L80,18 L92,68 L104,42 L230,42';

function Heartbeat() {
  return (
    <div className="ekg">
      <svg viewBox="0 0 230 84">
        <path className="line" d={PATH} />
      </svg>
      <span className="dot" style={{ offsetPath: `path("${PATH}")` }} />
    </div>
  );
}
```


## Pattern 30

# Battery Charge

Pattern 30 of 51 · Feedback and State Skills

Fill climbs as the bolt pulses

Source readout: `charge 3.6s loop`

## Original AI prompt

```text
Build a charging battery indicator: a rounded battery body with a small terminal nub on the right. Inside, a green gradient fill grows its width from ~14% to 100% on an infinite 3.6s ease-in-out loop, holding full briefly before looping. Centre a lightning bolt icon over it that gently pulses scale and opacity, and show a "Charging…" label below.
```

## Original CSS

```css
.fill {
  background: linear-gradient(90deg, #4cd08a, #74e2aa);
  animation: charge 3.6s ease-in-out infinite;
}
@keyframes charge {
  0%        { width: 14%; }
  85%, 100% { width: 100%; }
}
```

## Original React

```jsx
function Battery({ level }) {
  return (
    <div className="battery">
      <div
        className="fill"
        style={{ width: `${level}%`, transition: 'width 0.4s ease' }}
      />
      <BoltIcon className="bolt" />
    </div>
  );
}
```


## Pattern 31

# Signal Bars

Pattern 31 of 51 · Feedback and State Skills

Bars light up in sequence while connecting

Source readout: `stagger 2.4s loop`

## Original AI prompt

```text
Build a "connecting" signal-strength indicator: four bars of increasing height. Each has a green fill overlay that animates opacity 0→1→0 on an infinite 2.4s loop, with the four bars staggered by ~0.18s so they light up left-to-right in sequence, hold briefly, then clear and repeat — like a device searching for signal.
```

## Original CSS

```css
.bar::after {
  background: #4cd08a;
  animation: fill 2.4s ease-in-out infinite;
}
.bar:nth-child(2)::after { animation-delay: 0.18s; }
.bar:nth-child(3)::after { animation-delay: 0.36s; }
.bar:nth-child(4)::after { animation-delay: 0.54s; }
@keyframes fill {
  0% { opacity: 0; } 12%,70% { opacity: 1; } 82%,100% { opacity: 0; }
}
```

## Original React

```jsx
function SignalBars() {
  const heights = [32, 55, 78, 100];
  return (
    <div className="signal">
      {heights.map((h, i) => (
        <span
          key={i}
          className="bar"
          style={{ height: `${h}%`, animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}
```


## Pattern 32

# Badge Counter

Pattern 32 of 51 · Feedback and State Skills

Count springs on every add

Source readout: `spring pop 1.4×`

## Original AI prompt

```text
Build a cart icon with a numeric badge in the corner. On each click, increment the number and pop the badge to scale(1.4) with a spring cubic-bezier(0.34, 1.56, 0.64, 1), then remove the class after ~320ms so it springs back to rest. Force a reflow between removing and re-adding the class so rapid clicks re-trigger the bump every time.
```

## Original CSS

```css
.count { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.count.pop { transform: scale(1.4); }
/* toggle .pop off after ~320ms to let it spring back */
```

## Original React

```jsx
function CartBadge() {
  const [n, setN] = useState(1);
  const [pop, setPop] = useState(false);
  const add = () => {
    setN(n + 1);
    setPop(true);
    setTimeout(() => setPop(false), 320);
  };
  return (
    <button onClick={add}>
      <CartIcon />
      <span className={pop ? 'count pop' : 'count'}>{n}</span>
    </button>
  );
}
```


## Pattern 33

# Bookmark Toggle

Pattern 33 of 51 · Feedback and State Skills

Ribbon fills and drops in on save

Source readout: `drop spring`

## Original AI prompt

```text
Build a bookmark/ribbon save toggle backed by a hidden checkbox. When unchecked the ribbon is just an outline; when checked it fills with the accent colour and plays a one-shot "drop in" keyframe — start slightly above and small, overshoot down and large, then settle — using a spring cubic-bezier(0.34, 1.56, 0.64, 1). Tint the "Save" label to match. Pure CSS via :checked.
```

## Original CSS

```css
.mark svg { fill: transparent; stroke: #a8a6a0; transition: fill 0.3s, stroke 0.3s; }
.mark input:checked + svg {
  fill: #ff8a00; stroke: #ff8a00;
  animation: drop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes drop {
  0%   { transform: translateY(-9px) scale(0.9); }
  55%  { transform: translateY(3px)  scale(1.14); }
  100% { transform: translateY(0)    scale(1); }
}
```

## Original React

```jsx
function Bookmark() {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => setSaved(!saved)}
      className={saved ? 'mark on' : 'mark'}
      aria-pressed={saved}
    >
      <RibbonIcon />
    </button>
  );
}
```


## Pattern 34

# Packet Trace

Pattern 34 of 51 · Feedback and State Skills

Data pulses choose a route through a tiny network

Source readout: `dashoffset · 1.8s`

## Original AI prompt

```text
Build a tiny network-status visualization: three endpoint dots are connected by two angled routes, with a bright segmented packet stream moving along them. Keep the topology quiet and let only the travelling packets and destination glow communicate activity.
```

## Original CSS

```css
.packet-map i { stroke-dasharray: 7 8; animation: packet 1.8s linear infinite; }
@keyframes packet { to { stroke-dashoffset: -45; } }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 35

# Phase Lock

Pattern 35 of 51 · Feedback and State Skills

Three independent signals resolve into sync

Source readout: `lock · phase 3`

## Original AI prompt

```text
Create a compact synchronization status. Three dots orbit with different phase offsets while idle; on hover they resolve into a clean aligned row and reveal SYNC. It should make an abstract backend state feel delightfully physical without using a spinner.
```

## Original CSS

```css
.phase span { animation: orbit 1.4s ease-in-out infinite alternate; }
.phase span:nth-child(2) { animation-delay: -.23s; }
.phase:hover span { animation-delay: 0s; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 36

# Checksum Bloom

Pattern 36 of 51 · Feedback and State Skills

A verification string resolves from noise to trust

Source readout: `checksum · hover`

## Original AI prompt

```text
Design a checksum verification micro-state using a row of binary cells. On hover, cells bloom from dim neutral to green in a short sequential wave, ending at a highlighted check. It should feel more like a cryptographic handshake than a conventional success alert.
```

## Original CSS

```css
.checksum:hover span { color: var(--ok); transform: scale(1.15); }
.checksum span { transition: 0.35s var(--spring); transition-delay: calc(var(--i) * 35ms); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 37

# Echo Receipt

Pattern 37 of 51 · Feedback and State Skills

Acknowledgement ripples through three trust layers

Source readout: `echo · 90ms`

## Original AI prompt

```text
Show delivery acknowledgement as three overlapping checkmarks. A small scale-and-opacity echo travels from the first mark through the others, suggesting local receipt, server receipt, and peer receipt without labels.
```

## Original CSS

```css
.receipt span { animation: echo 1.8s var(--spring) infinite; }
.receipt span:nth-child(2) { animation-delay: .09s; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 38

# State Diff

Pattern 38 of 51 · Feedback and State Skills

The old value yields as the new state commits

Source readout: `diff · hover`

## Original AI prompt

```text
Visualize a tiny state transition as a two-line code diff. On hover the removed idle value drifts left and dims while the added live value slides into alignment and glows green.
```

## Original CSS

```css
.diff:hover p:first-child { opacity: .2; transform: translateX(-8px); }
.diff:hover p:last-child { opacity: 1; transform: translateX(0); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 39

# Signal Braille

Pattern 39 of 51 · Feedback and State Skills

A tactile dot matrix encodes live system phases

Source readout: `braille · 6 phase`

## Original AI prompt

```text
Build a six-dot status matrix inspired by Braille. Different dots illuminate in discrete timed phases to encode changing machine state, with a quiet READY label beneath. Avoid spinner and equalizer conventions.
```

## Original CSS

```css
.braille span { animation: cell 2.1s steps(1) infinite; }
.braille span:nth-child(2n) { animation-delay: -.7s; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 40

# Token Stream

Pattern 40 of 51 · Feedback and State Skills

Tokens cascade in like a live model response

Source readout: `stream · 3.6s`

## Original AI prompt

```text
Design an AI token-stream indicator. Render monospaced chips that pop in one after another with a spring, hold briefly as a completed phrase, then fade upward before looping. Highlight a mid-stream token in accent colour so it reads as generative output, not a generic loader.
```

## Original CSS

```css
.token {
  opacity: 0;
  transform: translateY(10px) scale(.92);
  animation: token-in 3.6s cubic-bezier(0.34,1.56,0.64,1) infinite;
}
.token:nth-child(n) { animation-delay: calc((n - 1) * 0.22s); }
@keyframes token-in {
  12%, 72% { opacity: 1; transform: none; }
  88%, 100% { opacity: 0; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 41

# Presence Stack

Pattern 41 of 51 · Feedback and State Skills

Avatars fan out with a live online pulse

Source readout: `presence · ping`

## Original AI prompt

```text
Build a collaborative presence stack: overlapping circular avatars with a green online dot that soft-pings, plus a +N overflow chip. On hover the stack fans slightly apart with staggered lifts so the group feels alive and multiplayer.
```

## Original CSS

```css
.presence span { margin-left: -12px; border-radius: 50%; border: 2px solid #0e0e10; }
.presence span.live::after {
  content: "";
  position: absolute; right: 1px; bottom: 1px;
  width: 10px; height: 10px; border-radius: 50%;
  background: #4cd08a;
  animation: ping 1.8s ease-out infinite;
}
.presence:hover span { transform: translateY(-6px) scale(1.06); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 42

# Confidence Settle

Pattern 42 of 51 · Feedback and State Skills

A score overshoots, then settles on the true value

Source readout: `settle · 2.8s`

## Original AI prompt

```text
Create a confidence meter for AI or ranking UIs. Animate a gradient fill that races past the target, then eases back to the final percentage with a spring. Update a tabular mono readout in lockstep so the number feels measured, not gimmicky.
```

## Original CSS

```css
.fill {
  background: linear-gradient(90deg, #5b8def, #4cd08a);
  animation: settle 2.8s cubic-bezier(0.34,1.56,0.64,1) infinite;
}
@keyframes settle {
  0% { width: 0; }
  55% { width: 96%; }
  72%, 100% { width: 87%; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 43

# Optimistic Rollback

Pattern 43 of 51 · Feedback and State Skills

An instant local update gracefully retracts after rejection

Source readout: `optimistic · rollback`

## Original AI prompt

```text
Visualize an optimistic UI update: a setting turns on immediately, reports APPLIED, waits in SYNCING, then softly rolls back to RESTORED when the server rejects it. Use restrained status colour, spring the toggle both ways, and avoid an aggressive error shake.
```

## Original CSS

```css
.optimistic-toggle {
  animation: optimistic-toggle 4s cubic-bezier(.34,1.56,.64,1) infinite;
}
@keyframes optimistic-toggle {
  0%, 12% { transform: translateX(0); }
  24%, 62% { transform: translateX(26px); }
  76%, 100% { transform: translateX(0); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 44

# Reconciliation Merge

Pattern 44 of 51 · Feedback and State Skills

Competing values converge into one authoritative state

Source readout: `local ↔ edge`

## Original AI prompt

```text
Show local-first data reconciliation. Two compact value chips approach from opposite sides, pause while a bridge scans between them, then dissolve into one authoritative SYNCED value. Keep the merge spatial and calm so it reads as data resolution rather than a generic success state.
```

## Original CSS

```css
.sources span { animation: reconcile-in 3.4s var(--spring) infinite; }
.reconcile strong { animation: authority-in 3.4s var(--spring) infinite; }
@keyframes authority-in {
  0%, 42% { opacity: 0; transform: scale(.82); }
  58%, 84% { opacity: 1; transform: scale(1); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 45

# Activity Ledger

Pattern 45 of 51 · Feedback and State Skills

Fresh events arrive sharply while older entries compact

Source readout: `live · compacting`

## Original AI prompt

```text
Design a live activity ledger where each incoming event lands crisply at the top, holds, then becomes quieter and slightly denser as it ages. Stagger three rows in one continuous cycle and use a moving edge dot to distinguish event freshness from a normal static timeline.
```

## Original CSS

```css
.ledger div {
  animation: ledger-age 4.6s cubic-bezier(.16,1,.3,1) infinite;
}
.ledger div:nth-child(2) { animation-delay: -.9s; }
.ledger div:nth-child(3) { animation-delay: -1.8s; }
@keyframes ledger-age {
  0% { opacity: 0; transform: translateY(-10px) scale(1.03); }
  18%, 58% { opacity: 1; transform: none; }
  100% { opacity: .22; transform: translateY(5px) scale(.95); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 46

# Agent Handoff

Pattern 46 of 51 · Feedback and State Skills

One agent hands the live context to the next along a trace

Source readout: `handoff · 5.2s cycle`

## Original AI prompt

```text
Visualise a multi-agent handoff: two labelled nodes joined by a thin trace. A context packet detaches from the first node, accelerates along the wire with an in-out curve, and lands in the second, which only heats up on arrival while the sender cools. Light the trace behind the packet like a charge and keep a monospaced context-size label that ticks over at the moment of transfer. One continuous loop, no spinners.
```

## Original CSS

```css
.handoff-wire b { animation: baton 5.2s cubic-bezier(.65,0,.35,1) infinite; }
.handoff-node:first-child i { animation: node-hot 5.2s ease-in-out infinite; }
.handoff-node:last-child  i { animation: node-hot 5.2s ease-in-out infinite 2.1s; }
@keyframes baton {
  0%, 14%  { offset-distance: 0%;   transform: scale(.4); opacity: 0; }
  22%      { transform: scale(1);   opacity: 1; }
  62%      { offset-distance: 100%; opacity: 1; }
  74%, 100%{ offset-distance: 100%; transform: scale(.4); opacity: 0; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 47

# Rate Limit Cooldown

Pattern 47 of 51 · Feedback and State Skills

A token bucket empties fast, then refills on a slow drip

Source readout: `bucket(5) · refill 1.1s`

## Original AI prompt

```text
Show a token-bucket rate limiter as a state animation. Five pips are spent left to right in quick succession, the status flips from a calm 200 to a warning 429, and a cooldown arc sweeps once. Then the pips return one at a time on a slow, uneven drip with a small overshoot as each is credited. The asymmetry is the point: spending is instant, recovery is patient.
```

## Original CSS

```css
.ratelimit-tokens i { animation: token-cycle 6.4s linear infinite; }
.ratelimit-tokens i:nth-child(2) { animation-delay: .16s; }  /* spend: fast */
.ratelimit-tokens i:nth-child(5) { animation-delay: .64s; }
@keyframes token-cycle {
  0%, 6%   { opacity: 1; transform: scale(1); }
  12%      { opacity: .1; transform: scale(.55); }  /* spent */
  55%      { opacity: .1; transform: scale(.55); }  /* throttled */
  70%      { opacity: 1; transform: scale(1.18); }  /* refilled */
  78%, 100%{ opacity: 1; transform: scale(1); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 48

# Vector Recall

Pattern 48 of 51 · Feedback and State Skills

Nearest embeddings drift in as a query ring sweeps the space

Source readout: `top-k(3) · cosine`

## Original AI prompt

```text
Illustrate semantic search over an embedding space. Scatter faint points around a bright query node, then expand a thin ring outward; the three nearest points brighten and drift a third of the way toward the query while the rest stay dim and still. Cross-fade a status readout from "querying" to a cosine score at the moment the matches land. Positions come from custom properties so the same rule animates every point.
```

## Original CSS

```css
.vector i {
  translate: var(--x) var(--y);
  transition: translate .6s cubic-bezier(.16,1,.3,1);
}
.vector i.hit { animation: recall 5.6s cubic-bezier(.16,1,.3,1) infinite; }
@keyframes recall {
  0%, 30%  { translate: var(--x) var(--y); opacity: .35; }
  52%, 78% { translate: calc(var(--x) * .34) calc(var(--y) * .34); opacity: 1; }
  100%     { translate: var(--x) var(--y); opacity: .35; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 49

# Stale While Revalidate

Pattern 49 of 51 · Feedback and State Skills

The old value ghosts as the fresh one springs into place

Source readout: `swr · 4.8s`

## Original AI prompt

```text
Show a stale-while-revalidate cycle. The current number stays on screen as STALE, then ghosts left and blurs while FETCH is active. The new number springs in from the right and a FRESH chip lights. Keep both values in the same slot so it reads as one datum being replaced, not two counters. Loop calmly — this is cache policy, not an error.
```

## Original CSS

```css
.swr span { animation: stale-ghost 4.8s cubic-bezier(.16,1,.3,1) infinite; }
.swr strong { animation: fresh-in 4.8s cubic-bezier(.34,1.56,.64,1) infinite; }
@keyframes stale-ghost {
  0%, 18% { opacity: 1; filter: none; }
  38%, 72% { opacity: .22; filter: blur(1.5px); transform: translateX(-10px) scale(.92); }
  88%, 100% { opacity: 1; filter: none; }
}
@keyframes fresh-in {
  0%, 28% { opacity: 0; transform: translateX(14px) scale(.86); }
  46%, 78% { opacity: 1; transform: none; }
  92%, 100% { opacity: 0; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 50

# Circuit Breaker

Pattern 50 of 51 · Feedback and State Skills

A physical arm throws closed, open, then half-open to probe

Source readout: `breaker · 6.8s`

## Original AI prompt

```text
Visualise a circuit breaker as a physical throw switch, not a spinner. Three LEDs (closed / open / half-open) light in lockstep with a pivoted arm that slams open, rests at a half-open probe angle, then springs closed again. Status copy swaps CLOSED, OPEN, HALF. The overshoot on the throw is the point — it should feel like a breaker, not a toggle.
```

## Original CSS

```css
.breaker-arm {
  transform-origin: 8px 50%;
  animation: throw 6.8s cubic-bezier(.34,1.56,.64,1) infinite;
}
@keyframes throw {
  0%, 18%  { rotate: 0deg; }    /* closed */
  28%, 48% { rotate: 78deg; }   /* open */
  58%, 74% { rotate: 38deg; }   /* half-open probe */
  86%, 100%{ rotate: 0deg; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 51

# Trace Flame

Pattern 51 of 51 · Feedback and State Skills

A request paints as stacked spans filling left to right

Source readout: `flame · 5.4s`

## Original AI prompt

```text
Draw a tiny distributed-trace flamegraph. Three nested spans (gateway, worker, db) of decreasing width fill from the left in sequence, each a different heat colour. A monospaced duration ticks to 69ms when the last span lands. This is a waterfall of work, not a progress bar — keep the rows stacked and left-aligned so parent and child are obvious.
```

## Original CSS

```css
.flame-row { width: var(--w); }
.flame-row i {
  transform-origin: left center;
  animation: span-fill 5.4s cubic-bezier(.16,1,.3,1) infinite;
}
.flame-row:nth-child(2) i { animation-delay: .28s; }
.flame-row:nth-child(3) i { animation-delay: .56s; }
@keyframes span-fill {
  0%, 8%  { transform: scaleX(0); }
  28%, 72%{ transform: scaleX(1); }
  88%, 100%{ transform: scaleX(0); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.

