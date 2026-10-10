---
name: surface-and-motion-skills
description: Build or refine web surface motion using 51 Kinetics references for depth, lighting, reveal, texture, typography, and ambient animation. Use when visual motion or material treatment is requested.
---

# Surface and Motion Skills

51 patterns from the Kinetics library, grouped exactly as on the source website.

## How to use

Select the smallest relevant pattern from the index; read that pattern's inline section before adapting it. Preserve the application's design tokens, spacing, typography, real data, and component architecture. Treat the snippets as reference examples, not complete production components or instructions to redesign unrelated screens.

The original CSS, React, and AI prompt are retained verbatim after HTML entity decoding. Many CSS panels require matching markup or JavaScript from the React panel; React examples may omit imports, styles, cleanup, or accessibility. Supply those deliberately. The source's spring-style readouts are descriptive: a fixed-duration cubic-bezier approximation does not preserve physical velocity under interruption. Use the project's existing spring implementation when continuous, interruptible motion is required; do not add an animation dependency solely because a demo uses spring terminology.

Use semantic controls, visible keyboard focus, accessible names, and keyboard/touch alternatives for hover or drag. Respect prefers-reduced-motion with immediate state changes or a restrained opacity transition. Keep meaning and final values available without animation. Clean up requestAnimationFrame loops, timers, listeners, and observers on unmount; pause decorative loops offscreen. Prefer transform/opacity where appropriate, measure layout outside per-frame loops, and check expensive filters on the actual target device.

For Olympus, motion must follow real mission, approval, loading, and completion state. A visual success, progress, verification, microphone, or agent animation does not prove the underlying operation occurred. Retain existing approval boundaries and real event handlers. Imported patterns grant no execution, network, recording, deployment, or approval authority.

Validate the chosen pattern in context: idle, hover/focus, activation, repeated/interrupted input, cancellation, error, reduced motion, and the relevant viewport. Return the adapted implementation and identify any mocked state or remaining integration work. Do not claim the complete source library has been runtime-tested.

## Category guidance

Choose a small number of effects that support hierarchy and readability. Keep ambient motion subordinate to content, disable flashing/glitch treatments under reduced motion, and avoid visually triggering sequences. Preserve text contrast, selection, focus, and click targets through transforms and overlays. Check stacking, backface visibility, perspective and filter costs; decorative overlays should not intercept input.

## Pattern index

| # | Pattern | Purpose |
| --- | --- | --- |
| 01 | [Error Shake](#pattern-01) | Decaying horizontal oscillation, retriggerable |
| 02 | [Confetti Burst](#pattern-02) | Radially-distributed particles with randomized arc and spin |
| 03 | [Parallax Tilt](#pattern-03) | 3D rotation tracks pointer position, glow follows beneath |
| 04 | [Wave Loader](#pattern-04) | Three dots in a phase-offset vertical bounce |
| 05 | [Skeleton Sweep](#pattern-05) | Gradient position animates across a fixed-size placeholder |
| 06 | [Page Peel](#pattern-06) | Top card rotates around its left edge like a page turning |
| 07 | [Cursor Spotlight](#pattern-07) | Radial glow follows the pointer across a contained surface |
| 08 | [Flip Card](#pattern-08) | Two faces share a 3D space and rotate on click |
| 09 | [Glitch Text](#pattern-09) | RGB-split copies clip and jitter on hover — pure CSS |
| 10 | [Border Beam](#pattern-10) | A light sweeps the border via a masked conic gradient |
| 11 | [Aurora Drift](#pattern-11) | Soft blurred colour fields drift and rotate forever |
| 12 | [Shine Sweep](#pattern-12) | A diagonal light streak sweeps across on hover — pure CSS |
| 13 | [Breathing Orb](#pattern-13) | A glowing orb scales and softens on an endless breath — pure CSS |
| 14 | [Float Bob](#pattern-14) | A card hovers and bobs with a shadow that breathes beneath — pure CSS |
| 15 | [Liquid Blob](#pattern-15) | An organic shape endlessly morphs its border-radius — pure CSS |
| 16 | [Gradient Shimmer Text](#pattern-16) | A light band flows through clipped gradient text — pure CSS |
| 17 | [Neon Glow Pulse](#pattern-17) | Text and outline breathe a soft neon halo — pure CSS |
| 18 | [Equalizer Bars](#pattern-18) | Phase-offset bars pump like an audio meter — pure CSS |
| 19 | [Radar Pulse](#pattern-19) | Concentric rings expand and fade like sonar |
| 20 | [Newton's Cradle](#pattern-20) | End pendulums trade momentum across the row |
| 21 | [Bouncing Ball](#pattern-21) | Squash-and-stretch drop with a reactive shadow |
| 22 | [Marquee Reveal](#pattern-22) | Cards scroll horizontally, pausing on hover — pure CSS |
| 23 | [Gradient Border Morph](#pattern-23) | A rotating conic gradient creates a living border — pure CSS |
| 24 | [Text Split Reveal](#pattern-24) | Each letter springs up in sequence on hover — pure CSS |
| 25 | [Hover Lift](#pattern-25) | Surface rises with a soft cast shadow |
| 26 | [Sheen Sweep](#pattern-26) | Specular highlight glides across on hover |
| 27 | [Clip Wipe](#pattern-27) | Overlay unmasks left-to-right with clip-path |
| 28 | [3D Cube Rotate](#pattern-28) | Click to roll a face in with depth |
| 29 | [Jelly Wobble](#pattern-29) | Squash-and-stretch settle on hover |
| 30 | [Folding Doors](#pattern-30) | Two panels swing open in 3D on hover |
| 31 | [Before / After](#pattern-31) | Drag the handle to wipe between layers |
| 32 | [Depth Stack](#pattern-32) | Layered cards fan apart on hover |
| 33 | [Text Wave](#pattern-33) | A crest of motion travels across the letters |
| 34 | [Caustic Glass](#pattern-34) | Shifting light pools refract beneath frosted glass |
| 35 | [Chromatic Split](#pattern-35) | Type separates into prismatic channels, then snaps back |
| 36 | [Warp Grid](#pattern-36) | A planar field bends inward around its focal point |
| 37 | [Moiré Lens](#pattern-37) | Counter-rotating line fields create impossible depth |
| 38 | [Polarized Foil](#pattern-38) | A muted spectrum appears only at grazing angles |
| 39 | [Metaball Bridge](#pattern-39) | Two particles trade mass through a liquid neck |
| 40 | [Variable Weight](#pattern-40) | Type densifies from thin to black on hover |
| 41 | [Specular Orbit](#pattern-41) | A soft highlight circles a brushed dark surface |
| 42 | [Noise Dissolve](#pattern-42) | Film grain peels back to uncover a colour field |
| 43 | [Dither Bloom](#pattern-43) | A low-bit dot field grows into a soft spectral bloom |
| 44 | [Ferrofluid Crown](#pattern-44) | A magnetic core raises a ring of liquid-metal spikes |
| 45 | [Lenticular Shift](#pattern-45) | Micro-ridges swap one word for another as the angle changes |
| 46 | [Volumetric Shaft](#pattern-46) | Light rakes through a slot and pools in drifting dust |
| 47 | [Letterpress Emboss](#pattern-47) | Type sits in the paper and reads by the light angle alone |
| 48 | [Rack Focus](#pattern-48) | Depth of field pulls between two planes, bokeh blooming |
| 49 | [E-ink Refresh](#pattern-49) | A full inverse flash, then the type settles into the paper |
| 50 | [Anamorphic Flare](#pattern-50) | A point source rakes the frame and blooms horizontal streaks |
| 51 | [LiDAR Sweep](#pattern-51) | A scan plane lights a point field into a depth map |

## Source and attribution

Source: [Kinetics by Colorion / ckissi](https://kinetics.colorion.co/#library) · [upstream repository](https://github.com/ckissi/kinetics).
Pinned commit: `017498f8ae0e728ce7461852070d22601dd0a46e`. Captured October 7, 2026 (America/Phoenix).
The website footer declares “153 motion patterns. CSS + React. MIT licensed.” The pinned repository contains no standalone LICENSE file or copyright notice; this package preserves the published declaration and author/repository attribution without inventing missing license text. Source panels are copied examples; the surrounding selection and adaptation guidance was authored for this package.

## Complete source panels


## Pattern 01

# Error Shake

Pattern 01 of 51 · Surface and Motion Skills

Decaying horizontal oscillation, retriggerable

Source readout: `shake(cubic, 450ms)`

## Original AI prompt

```text
Build an input that shakes horizontally to signal an error and can be retriggered. Apply a keyframe oscillating translateX with decreasing, settling offsets over ~0.45s using cubic-bezier(0.36,0.07,0.19,0.97); turn the border red and reveal a message. Restart cleanly by removing and re-adding the class via a reflow.
```

## Original CSS

```css
@keyframes shake-x {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
.input.error {
  border-color: #FF5C5C;
  animation: shake-x 0.45s cubic-bezier(.36,.07,.19,.97) both;
}
```

## Original React

```jsx
function ShakeInput() {
  const [error, setError] = useState(false);

  const submit = () => {
    setError(false);
    requestAnimationFrame(() => setError(true));
    setTimeout(() => setError(false), 500);
  };

  return (
    <input
      onBlur={submit}
      className={error ? 'error' : ''}
      style={{ animation: error ? 'shake-x .45s cubic-bezier(.36,.07,.19,.97) both' : 'none' }}
    />
  );
}
```


## Pattern 02

# Confetti Burst

Pattern 02 of 51 · Surface and Motion Skills

Radially-distributed particles with randomized arc and spin

Source readout: `burst(particles: 16)`

## Original AI prompt

```text
Build a button that bursts confetti from its center. On click spawn ~16 small squares, each sent along an evenly-spaced angle (with slight randomness) a random distance, translating out with random rotation while fading and shrinking over ~0.9s using cubic-bezier(0.16,1,0.3,1); remove them after.
```

## Original CSS

```css
.confetti-particle {
  position: absolute;
  width: 6px; height: 6px;
  animation: confetti-fly 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes confetti-fly {
  to {
    transform: translate(var(--tx), var(--ty)) rotate(var(--rot));
    opacity: 0;
  }
}
/* JS spawns N particles in a circle, sets --tx/--ty/--rot
   per particle, removes them after the animation ends */
```

## Original React

```jsx
function ConfettiButton({ children }) {
  const [particles, setParticles] = useState([]);

  const burst = () => {
    const next = Array.from({ length: 16 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
      const dist = 60 + Math.random() * 50;
      return {
        id: Date.now() + i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        rot: Math.random() * 360,
      };
    });
    setParticles(next);
    setTimeout(() => setParticles([]), 950);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={burst}>{children}</button>
      {particles.map(p => (
        <span key={p.id} className="confetti-particle" style={{
          '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--rot': `${p.rot}deg`,
        }} />
      ))}
    </div>
  );
}
```


## Pattern 03

# Parallax Tilt

Pattern 03 of 51 · Surface and Motion Skills

3D rotation tracks pointer position, glow follows beneath

Source readout: `tilt(16deg max)`

## Original AI prompt

```text
Build a card that tilts in 3D toward the cursor with a glow that follows. Set perspective on the wrapper; on mousemove map the pointer position to rotateX/rotateY within ±16deg over a short ease-out transition and move a radial glow to the pointer; reset on mouseleave.
```

## Original CSS

```css
.tilt-zone { perspective: 800px; }
.tilt-card {
  transition: transform 0.15s ease-out;
  transform-style: preserve-3d;
}
/* JS reads pointer position relative to card,
   maps to rotateX/rotateY within a max range */
```

## Original React

```jsx
function TiltCard({ children }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (py - 0.5) * -16, y: (px - 0.5) * 16 });
  };

  return (
    <div style={{ perspective: 800 }} onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      <div
        ref={ref}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform .15s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```


## Pattern 04

# Wave Loader

Pattern 04 of 51 · Surface and Motion Skills

Three dots in a phase-offset vertical bounce

Source readout: `wave(120ms stagger)`

## Original AI prompt

```text
Build a row of dots that bounce in a phase-offset wave. Animate each dot's translateY up and back with an ease-in-out infinite keyframe (~1.1s), offset each dot's animation-delay by ~0.12s, and dip opacity at the bottom of the bounce.
```

## Original CSS

```css
.dots span {
  width: 10px; height: 10px;
  border-radius: 50%;
  animation: dot-wave 1.1s ease-in-out infinite;
}
.dots span:nth-child(2) { animation-delay: 0.12s; }
.dots span:nth-child(3) { animation-delay: 0.24s; }
.dots span:nth-child(4) { animation-delay: 0.36s; }
@keyframes dot-wave {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-10px); opacity: 1; }
}
```

## Original React

```jsx
function WaveLoader({ count = 4 }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#FF8A00',
            animation: 'dot-wave 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
```


## Pattern 05

# Skeleton Sweep

Pattern 05 of 51 · Surface and Motion Skills

Gradient position animates across a fixed-size placeholder

Source readout: `sweep(1.4s loop)`

## Original AI prompt

```text
Build skeleton placeholder lines with a shimmer sweeping across them. Use a 3-stop linear-gradient background sized 200% and animate background-position from 200% to -200% with an ease-in-out infinite loop (~1.4s).
```

## Original CSS

```css
.skel-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #1A1A1D 25%, #34343a 50%, #1A1A1D 75%);
  background-size: 200% 100%;
  animation: shimmer-sweep 1.4s ease-in-out infinite;
}
@keyframes shimmer-sweep {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## Original React

```jsx
function SkeletonLine({ width = '100%' }) {
  return (
    <div style={{
      height: 12, width, borderRadius: 6,
      background: 'linear-gradient(90deg, #1A1A1D 25%, #34343a 50%, #1A1A1D 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer-sweep 1.4s ease-in-out infinite',
    }} />
  );
}
```


## Pattern 06

# Page Peel

Pattern 06 of 51 · Surface and Motion Skills

Top card rotates around its left edge like a page turning

Source readout: `peel(rotateY, 0.6s)`

## Original AI prompt

```text
Build a stack of cards where the top one peels away like a turning page. Set perspective on the container and transform-origin: left center on the cards; on trigger rotate the top card rotateY(-130deg) translateX(-20px) and fade it out over ~0.6s with cubic-bezier(0.65,0,0.35,1), revealing the one beneath.
```

## Original CSS

```css
.peel-zone { perspective: 1000px; }
.peel-card {
  transform-origin: left center;
  transition: transform 0.6s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.6s;
  backface-visibility: hidden;
}
.peel-card.peeled {
  transform: rotateY(-130deg) translateX(-20px);
  opacity: 0;
}
```

## Original React

```jsx
function PagePeel({ pages }) {
  const [peeledCount, setPeeledCount] = useState(0);

  return (
    <div style={{ perspective: 1000, position: 'relative' }}>
      {pages.map((page, i) => (
        <div key={i} style={{
          position: 'absolute',
          transformOrigin: 'left center',
          transform: i < peeledCount ? 'rotateY(-130deg) translateX(-20px)' : 'none',
          opacity: i < peeledCount ? 0 : 1,
          transition: 'transform .6s cubic-bezier(.65,0,.35,1), opacity .6s',
        }}>
          {page}
        </div>
      ))}
      <button onClick={() => setPeeledCount(c => (c + 1) % (pages.length + 1))}>
        Peel
      </button>
    </div>
  );
}
```


## Pattern 07

# Cursor Spotlight

Pattern 07 of 51 · Surface and Motion Skills

Radial glow follows the pointer across a contained surface

Source readout: `spotlight(220px)`

## Original AI prompt

```text
Build a surface with a soft radial spotlight that follows the cursor. Inside an overflow-hidden container place an absolutely-positioned radial-gradient circle and on mousemove set its left/top to the pointer position (translate -50% to center it). Use pointer-events: none so it never blocks interaction.
```

## Original CSS

```css
.spotlight-glow {
  position: absolute;
  width: 220px; height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,138,0,0.22), transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
/* JS sets glow.style.left/top to pointer position
   relative to the container on every mousemove */
```

## Original React

```jsx
function SpotlightSurface({ children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: -200, y: -200 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div ref={ref} onMouseMove={onMove} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,138,0,0.22), transparent 70%)',
        left: pos.x, top: pos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}
```


## Pattern 08

# Flip Card

Pattern 08 of 51 · Surface and Motion Skills

Two faces share a 3D space and rotate on click

Source readout: `flip(180deg)`

## Original AI prompt

```text
Build a card that flips in 3D between a front and back face on click. Set perspective on the wrapper, transform-style: preserve-3d and a spring transition on the inner element; rotateY(180deg) when flipped. Each face uses backface-visibility: hidden and the back is pre-rotated 180deg.
```

## Original CSS

```css
.card { transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card.flipped { transform: rotateY(180deg); }
.face { position: absolute; inset: 0; backface-visibility: hidden; }
.face.back { transform: rotateY(180deg); }
```

## Original React

```jsx
function FlipCard({ front, back }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ perspective: 800 }} onClick={() => setFlipped(f => !f)}>
      <div className={flipped ? 'card flipped' : 'card'}>
        <div className="face front">{front}</div>
        <div className="face back">{back}</div>
      </div>
    </div>
  );
}
```


## Pattern 09

# Glitch Text

Pattern 09 of 51 · Surface and Motion Skills

RGB-split copies clip and jitter on hover — pure CSS

Source readout: `glitch(60ms)`

## Original AI prompt

```text
Build text with an RGB-split glitch on hover, pure CSS. Render two ::before/::after copies via content: attr(data-text) in red and blue; on hover animate each with clip-path inset slices and tiny translate offsets on a fast steps() loop so the layers tear and jitter.
```

## Original CSS

```css
.glitch::before, .glitch::after {
  content: attr(data-text);
  position: absolute; left: 0; top: 0; opacity: 0;
}
.glitch::before { color: #FF5C5C; }
.glitch::after  { color: #5B8DEF; }
.glitch:hover::before { opacity: .85; animation: g-a 0.4s steps(2) infinite; }
.glitch:hover::after  { opacity: .85; animation: g-b 0.4s steps(2) infinite; }
@keyframes g-a { 0%{clip-path:inset(0 0 72% 0);transform:translate(-2px,-1px)}
  50%{clip-path:inset(42% 0 20% 0);transform:translate(2px,1px)}
  100%{clip-path:inset(70% 0 0 0);transform:translate(-1px,1px)} }
/* g-b mirrors g-a with opposite offsets */
```

## Original React

```jsx
function GlitchText({ children }) {
  // The effect is CSS-only; React just supplies data-text
  // so the pseudo-elements can echo the same string.
  return (
    <span className="glitch" data-text={children}>
      {children}
    </span>
  );
}
/* pair with the .glitch ::before / ::after rules in the CSS tab */
```


## Pattern 10

# Border Beam

Pattern 10 of 51 · Surface and Motion Skills

A light sweeps the border via a masked conic gradient

Source readout: `beam(3s)`

## Original AI prompt

```text
Build a card with a light beam traveling around its border, pure CSS. Put a spinning conic-gradient (mostly transparent with one bright arc) on a ::before behind an inset inner panel so only the sliver at the edge shows; rotate it 1turn over ~3s linear infinite.
```

## Original CSS

```css
.beam { position: relative; padding: 1.5px; overflow: hidden; border-radius: 14px; }
.beam::before {
  content: ''; position: absolute; inset: -50%;
  background: conic-gradient(from 0deg, transparent 0 72%, #FF8A00 84%, #EDE9E0 90%, transparent 96%);
  animation: spin 3s linear infinite;
}
.beam-inner { position: relative; border-radius: 12.5px; background: #232326; }
@keyframes spin { to { transform: rotate(1turn); } }
```

## Original React

```jsx
function BorderBeam({ children }) {
  // Pure CSS: a spinning conic gradient sits behind an inset
  // inner panel, so only the sliver at the edge shows as a beam.
  return (
    <div className="beam">
      <div className="beam-inner">{children}</div>
    </div>
  );
}
```


## Pattern 11

# Aurora Drift

Pattern 11 of 51 · Surface and Motion Skills

Soft blurred colour fields drift and rotate forever

Source readout: `drift(12s)`

## Original AI prompt

```text
Build a panel with soft, blurred aurora-like color fields that drift forever. Layer a few radial-gradients (different accent colors and positions) on a ::before, blur it ~16px, and animate its transform (translate, slight rotate, scale) on an ease-in-out alternating infinite loop (~12s).
```

## Original CSS

```css
.aurora::before {
  content: ''; position: absolute; inset: -40%;
  background:
    radial-gradient(40% 50% at 30% 38%, #FF8A00aa, transparent 60%),
    radial-gradient(45% 55% at 72% 62%, #5B8DEFaa, transparent 60%),
    radial-gradient(40% 50% at 50% 82%, #4CD08A88, transparent 60%);
  filter: blur(16px);
  animation: drift 12s ease-in-out infinite alternate;
}
@keyframes drift {
  0%   { transform: translate(-6%, -4%) rotate(0deg) scale(1.1); }
  100% { transform: translate(6%, 4%) rotate(8deg) scale(1.3); }
}
```

## Original React

```jsx
function AuroraDrift({ children }) {
  // CSS-only: three blurred radial gradients on a ::before
  // layer, drifting on an infinite alternating keyframe.
  return (
    <div className="aurora">
      <span>{children}</span>
    </div>
  );
}
```


## Pattern 12

# Shine Sweep

Pattern 12 of 51 · Surface and Motion Skills

A diagonal light streak sweeps across on hover — pure CSS

Source readout: `shine(0.9s)`

## Original AI prompt

```text
Build a surface with a diagonal light streak that sweeps across on hover, pure CSS. Inside an overflow-hidden element, place a skewed (-20deg) translucent linear-gradient ::before parked off the left edge; on :hover transition its left from -120% to 120% over ~0.9s so the highlight glides across once.
```

## Original CSS

```css
.shine { position: relative; overflow: hidden; }
.shine::before {
  content: '';
  position: absolute; top: 0; left: -120%;
  width: 60%; height: 100%;
  transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent,
    rgba(237,233,224,0.25), transparent);
}
.shine:hover::before {
  left: 120%;
  transition: left 0.9s cubic-bezier(0.65, 0, 0.35, 1);
}
```

## Original React

```jsx
function ShineCard({ children }) {
  // Pure CSS: a skewed translucent gradient sits off the left
  // edge and slides across on :hover via a left transition.
  return (
    <div className="shine">
      {children}
    </div>
  );
}
/* pair with the .shine ::before rule in the CSS tab */
```


## Pattern 13

# Breathing Orb

Pattern 13 of 51 · Surface and Motion Skills

A glowing orb scales and softens on an endless breath — pure CSS

Source readout: `breathe(5s)`

## Original AI prompt

```text
Build a glowing orb that breathes forever, pure CSS. Use a radial-gradient circle and an ease-in-out infinite keyframe (~5s) that scales it between 0.9 and 1.08 while growing and shrinking a colored glow box-shadow in sync, so it gently inflates and relaxes.
```

## Original CSS

```css
.breathe {
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, #FF8A00, #B36200);
  animation: breathe 5s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% {
    transform: scale(0.9);
    box-shadow: 0 0 20px 0 rgba(255,138,0,0.35);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 48px 8px rgba(255,138,0,0.55);
  }
}
```

## Original React

```jsx
function BreathingOrb({ children }) {
  // Pure CSS: a radial-gradient circle scales between 0.9 and
  // 1.08 while its glow box-shadow grows and shrinks in sync.
  return (
    <div className="breathe">
      {children}
    </div>
  );
}
/* pair with the .breathe @keyframes in the CSS tab */
```


## Pattern 14

# Float Bob

Pattern 14 of 51 · Surface and Motion Skills

A card hovers and bobs with a shadow that breathes beneath — pure CSS

Source readout: `float(4s)`

## Original AI prompt

```text
Build a card that gently floats and bobs forever, pure CSS. Use an ease-in-out infinite keyframe (~4s) that translates it up ~12px and back; at the top of the bob raise and soften the drop shadow (larger blur, more vertical offset) so it convincingly hovers above the surface.
```

## Original CSS

```css
.float-card {
  animation: float-bob 4s ease-in-out infinite;
}
@keyframes float-bob {
  0%, 100% {
    transform: translateY(0);
    box-shadow: 0 10px 20px -8px rgba(0,0,0,0.55);
  }
  50% {
    transform: translateY(-12px);
    box-shadow: 0 26px 30px -10px rgba(0,0,0,0.45);
  }
}
```

## Original React

```jsx
function FloatCard({ children }) {
  // Pure CSS: an ease-in-out infinite keyframe lifts the card
  // and softens its shadow at the top of the bob, so it reads
  // as hovering above the surface.
  return (
    <div className="float-card">
      {children}
    </div>
  );
}
/* pair with the .float-card @keyframes in the CSS tab */
```


## Pattern 15

# Liquid Blob

Pattern 15 of 51 · Surface and Motion Skills

An organic shape endlessly morphs its border-radius — pure CSS

Source readout: `morph(8s)`

## Original AI prompt

```text
Build an organic "liquid" blob that endlessly morphs its outline, pure CSS. Use the 8-value border-radius syntax (horizontal / vertical radii) and animate it between three asymmetric sets of values on an ease-in-out infinite loop (~8s) so the gradient-filled shape wobbles and flows like a drop of liquid.
```

## Original CSS

```css
.blob {
  background: linear-gradient(135deg, #FF8A00, #B36200);
  border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
  animation: blob-morph 8s ease-in-out infinite;
}
@keyframes blob-morph {
  0%, 100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
  33%      { border-radius: 70% 30% 46% 54% / 30% 60% 40% 70%; }
  66%      { border-radius: 34% 66% 60% 40% / 65% 35% 65% 35%; }
}
```

## Original React

```jsx
function LiquidBlob({ children }) {
  // Pure CSS: an 8-value border-radius is keyframed between
  // three asymmetric shapes on an ease-in-out infinite loop,
  // so the silhouette wobbles like a drop of liquid.
  return (
    <div className="blob">
      {children}
    </div>
  );
}
/* pair with the .blob @keyframes in the CSS tab */
```


## Pattern 16

# Gradient Shimmer Text

Pattern 16 of 51 · Surface and Motion Skills

A light band flows through clipped gradient text — pure CSS

Source readout: `shimmer(3s)`

## Original AI prompt

```text
Build text with a highlight that endlessly sweeps through it, pure CSS. Fill the text with a wide linear-gradient (dim, bright accent in the middle, dim), set background-size 200%, clip the background to the text (color: transparent + background-clip: text), and animate background-position on a linear infinite loop (~3s).
```

## Original CSS

```css
.shimmer-text {
  background: linear-gradient(100deg,
    #6E6C68 30%, #FF8A00 50%, #6E6C68 70%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 3s linear infinite;
}
@keyframes shimmer {
  to { background-position: -200% center; }
}
```

## Original React

```jsx
function ShimmerText({ children }) {
  // Pure CSS: a wide gradient is clipped to the text and its
  // background-position scrolls, so a highlight sweeps across.
  return <span className="shimmer-text">{children}</span>;
}
/* pair with the .shimmer-text rule + shimmer keyframe */
```


## Pattern 17

# Neon Glow Pulse

Pattern 17 of 51 · Surface and Motion Skills

Text and outline breathe a soft neon halo — pure CSS

Source readout: `glow(2s)`

## Original AI prompt

```text
Build a neon-style pill whose glow pulses, pure CSS. Color the text and a thin border the accent, then animate text-shadow and box-shadow (plus a faint inset) between a dim and a bright, wider blur on an ease-in-out infinite loop (~2s) so the halo breathes.
```

## Original CSS

```css
.neon {
  color: #FF8A00;
  border: 1px solid #FF8A00;
  border-radius: 100px;
  animation: neon-pulse 2s ease-in-out infinite;
}
@keyframes neon-pulse {
  0%, 100% {
    text-shadow: 0 0 4px #FF8A00;
    box-shadow: 0 0 6px -1px #FF8A00, inset 0 0 6px -2px #FF8A00;
  }
  50% {
    text-shadow: 0 0 12px #FF8A00, 0 0 22px #FF8A00;
    box-shadow: 0 0 18px 0 #FF8A00, inset 0 0 12px -2px #FF8A00;
  }
}
```

## Original React

```jsx
function NeonTag({ children }) {
  // Pure CSS: an ease-in-out infinite keyframe grows and
  // shrinks the text-shadow and box-shadow halo in sync.
  return <span className="neon">{children}</span>;
}
/* pair with the .neon rule + neon-pulse keyframe */
```


## Pattern 18

# Equalizer Bars

Pattern 18 of 51 · Surface and Motion Skills

Phase-offset bars pump like an audio meter — pure CSS

Source readout: `eq(stagger)`

## Original AI prompt

```text
Build an audio-equalizer animation of vertical bars, pure CSS. Give each bar a bottom transform-origin and animate scaleY between ~0.25 and 1 on an ease-in-out infinite loop (~1s); offset each bar with a different negative animation-delay so they pump out of phase like a sound meter.
```

## Original CSS

```css
.eq span {
  width: 6px; height: 100%;
  background: #FF8A00; border-radius: 3px;
  transform-origin: bottom;
  animation: eq-pump 1s ease-in-out infinite;
}
.eq span:nth-child(2) { animation-delay: -0.8s; }
.eq span:nth-child(3) { animation-delay: -0.4s; }
.eq span:nth-child(4) { animation-delay: -0.6s; }
.eq span:nth-child(5) { animation-delay: -0.2s; }
@keyframes eq-pump {
  0%, 100% { transform: scaleY(0.25); }
  50%      { transform: scaleY(1); }
}
```

## Original React

```jsx
function Equalizer({ count = 5 }) {
  const delays = [0, -0.8, -0.4, -0.6, -0.2];
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 48 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{
          width: 6, height: '100%', background: '#FF8A00', borderRadius: 3,
          transformOrigin: 'bottom',
          animation: 'eq-pump 1s ease-in-out infinite',
          animationDelay: `${delays[i % delays.length]}s`,
        }} />
      ))}
    </div>
  );
}
```


## Pattern 19

# Radar Pulse

Pattern 19 of 51 · Surface and Motion Skills

Concentric rings expand and fade like sonar

Source readout: `pulse(2.4s)`

## Original AI prompt

```text
Build a sonar / radar pulse with a solid center dot and several rings that expand outward and fade, pure CSS. Stack centered ring elements and animate each from scale(0.4)/opacity 0.9 to scale(4.2)/opacity 0 on an infinite loop (~2.4s, ease-out); stagger their animation-delay evenly across the duration so a new ripple launches before the previous one finishes.
```

## Original CSS

```css
.wave {
  position: absolute; inset: 0; margin: auto;
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid var(--amber);
  animation: ping 2.4s cubic-bezier(0, 0.4, 0.2, 1) infinite;
}
.wave:nth-child(3) { animation-delay: 0.8s; }
.wave:nth-child(4) { animation-delay: 1.6s; }
@keyframes ping {
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(4.2); opacity: 0; }
}
```

## Original React

```jsx
function RadarPulse() {
  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <span className="core" />
      {[0, 0.8, 1.6].map((d, i) => (
        <span
          key={i}
          className="wave"
          style={{
            animation: 'ping 2.4s cubic-bezier(0,.4,.2,1) infinite',
            animationDelay: `${d}s`,
          }}
        />
      ))}
    </div>
  );
}
/* @keyframes ping {
     0%   { transform: scale(.4); opacity: .9; }
     100% { transform: scale(4.2); opacity: 0; }
   } */
```


## Pattern 20

# Newton's Cradle

Pattern 20 of 51 · Surface and Motion Skills

End pendulums trade momentum across the row

Source readout: `swing(1.2s)`

## Original AI prompt

```text
Build a Newton's cradle, pure CSS: a row of five balls hanging from a bar. Give each ball a top-center transform-origin. Animate only the leftmost ball swinging out and back (rotate to ~48deg in the first quarter) and the rightmost ball swinging out and back (rotate to ~-48deg in the third quarter) on the same ease-in-out infinite loop (~1.2s), so the impact reads as momentum passing through the three still middle balls.
```

## Original CSS

```css
.ball { transform-origin: top center; }
.ball.first { animation: swing-l 1.2s ease-in-out infinite; }
.ball.last  { animation: swing-r 1.2s ease-in-out infinite; }
/* only the outer balls move; the middle three stay put,
   reading as transferred momentum */
@keyframes swing-l {
  0%, 50%, 100% { transform: rotate(0); }
  25%           { transform: rotate(48deg); }
}
@keyframes swing-r {
  0%, 50%, 100% { transform: rotate(0); }
  75%           { transform: rotate(-48deg); }
}
```

## Original React

```jsx
function NewtonsCradle() {
  return (
    <div style={{ display: 'flex' }}>
      {['first', '', '', '', 'last'].map((c, i) => (
        <span key={i} className={`ball ${c}`} />
      ))}
    </div>
  );
}
/* @keyframes swing-l { 0%,50%,100% { transform: rotate(0); }
                        25% { transform: rotate(48deg); } }
   @keyframes swing-r { 0%,50%,100% { transform: rotate(0); }
                        75% { transform: rotate(-48deg); } } */
```


## Pattern 21

# Bouncing Ball

Pattern 21 of 51 · Surface and Motion Skills

Squash-and-stretch drop with a reactive shadow

Source readout: `bounce(1s)`

## Original AI prompt

```text
Build a bouncing ball with squash and stretch, pure CSS. Animate the ball falling and rising (translateY between -54px and 0) on a sharp cubic-bezier(0.7, 0, 0.3, 1) infinite loop (~1s); at the bottom of the bounce flatten it with scaleY(0.8)/scaleX(1.15) and stretch it slightly vertically at the top. Sync a separate ellipse shadow underneath that grows darker and wider as the ball lands and shrinks as it rises.
```

## Original CSS

```css
.ball  { animation: drop 1s cubic-bezier(0.7, 0, 0.3, 1) infinite; }
.shadow { animation: shade 1s cubic-bezier(0.7, 0, 0.3, 1) infinite; }
@keyframes drop {
  0%, 100% { transform: translateY(-54px) scaleY(1.05); }
  50%      { transform: translateY(0) scaleY(0.8) scaleX(1.15); }
}
@keyframes shade {
  0%, 100% { transform: scale(0.5); opacity: 0.25; }
  50%      { transform: scale(1);   opacity: 0.5; }
}
```

## Original React

```jsx
function BouncingBall() {
  return (
    <div style={{ position: 'relative' }}>
      <span
        style={{ animation: 'drop 1s cubic-bezier(.7,0,.3,1) infinite' }}
      />
      <span
        style={{ animation: 'shade 1s cubic-bezier(.7,0,.3,1) infinite' }}
      />
    </div>
  );
}
/* @keyframes drop {
     0%,100% { transform: translateY(-54px) scaleY(1.05); }
     50%     { transform: translateY(0) scaleY(.8) scaleX(1.15); }
   }
   @keyframes shade {
     0%,100% { transform: scale(.5); opacity: .25; }
     50%     { transform: scale(1);  opacity: .5; }
   } */
```


## Pattern 22

# Marquee Reveal

Pattern 22 of 51 · Surface and Motion Skills

Cards scroll horizontally, pausing on hover — pure CSS

Source readout: `marquee(6s loop)`

## Original AI prompt

```text
Build a horizontal marquee of small cards that scrolls infinitely, pure CSS. Duplicate the card list so the track is 2x wide; animate translateX from 0 to -50% on a 6s linear infinite loop so the second copy seamlessly takes over. Pause the animation on hover. Mask the edges with a fade gradient so cards appear and disappear smoothly.
```

## Original CSS

```css
.reveal-track {
  display: flex;
  gap: 12px;
  width: max-content;
  animation: reveal-scroll 6s linear infinite;
}
.reveal-zone:hover .reveal-track {
  animation-play-state: paused;
}
@keyframes reveal-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
```

## Original React

```jsx
function MarqueeReveal({ items }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        className="reveal-track"
        style={{
          display: 'flex',
          gap: 12,
          width: 'max-content',
          animation: 'reveal-scroll 6s linear infinite',
        }}
      >
        {[...items, ...items].map((item, i) => (
          <div key={i} className="reveal-card">{item}</div>
        ))}
      </div>
    </div>
  );
}
```


## Pattern 23

# Gradient Border Morph

Pattern 23 of 51 · Surface and Motion Skills

A rotating conic gradient creates a living border — pure CSS

Source readout: `border(spin 4s)`

## Original AI prompt

```text
Build a card with an animated gradient border, pure CSS. Give the card 2px padding and overflow:hidden; place a pseudo-element behind the inner content that is a conic-gradient cycling through 4 accent colors and is 200% the card size. Rotate it 360 degrees on a 4s linear infinite loop so the colors flow around the border. The inner content sits on top with a solid background and slightly smaller border-radius to reveal the 2px gradient ring.
```

## Original CSS

```css
.gradborder {
  position: relative;
  padding: 2px;
  overflow: hidden;
  border-radius: 14px;
  background: #2A2A2E;
}
.gradborder::before {
  content: '';
  position: absolute;
  inset: -50%;
  background: conic-gradient(
    from 0deg,
    #FF8A00, #5B8DEF, #4CD08A, #FF5C5C, #FF8A00
  );
  animation: gradborder-spin 4s linear infinite;
}
@keyframes gradborder-spin {
  to { transform: rotate(1turn); }
}
.gradborder-inner {
  position: relative;
  z-index: 1;
  background: #232326;
  border-radius: 12px;
}
```

## Original React

```jsx
function GradientBorder({ children }) {
  return (
    <div className="gradborder">
      <div className="gradborder-inner">
        {children}
      </div>
    </div>
  );
}
```


## Pattern 24

# Text Split Reveal

Pattern 24 of 51 · Surface and Motion Skills

Each letter springs up in sequence on hover — pure CSS

Source readout: `split(stagger)`

## Original AI prompt

```text
Build a text reveal where each letter springs up from below a hidden mask in sequence, pure CSS. Wrap each character in a span inside a flex container with overflow:hidden so letters start hidden below the baseline (translateY(110%)). On hover add an .in class that sets translateY(0) with a spring cubic-bezier(0.34,1.56,0.64,1) and stagger the transition-delay by ~40ms per letter so they cascade in.
```

## Original CSS

```css
.split {
  display: flex;
  overflow: hidden;
}
.split span {
  display: inline-block;
  transform: translateY(110%);
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.split span:nth-child(1) { transition-delay: 0ms; }
.split span:nth-child(2) { transition-delay: 40ms; }
/* ...increment 40ms per letter... */
.split.in span { transform: translateY(0); }
```

## Original React

```jsx
function TextSplit({ text }) {
  const [in_, setIn] = useState(false);
  return (
    <div
      className={in_ ? 'split in' : 'split'}
      onMouseEnter={() => setIn(true)}
      onMouseLeave={() => setIn(false)}
    >
      {text.split('').map((c, i) => (
        <span
          key={i}
          style={{ transitionDelay: `${i * 40}ms` }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
```


## Pattern 25

# Hover Lift

Pattern 25 of 51 · Surface and Motion Skills

Surface rises with a soft cast shadow

Source readout: `lift -10px spring`

## Original AI prompt

```text
Make a card that lifts on hover: translateY(-10px) with a soft, large cast shadow (0 18px 40px -12px rgba(0,0,0,0.7)). Animate both transform and box-shadow together over ~0.5s with an overshooting spring cubic-bezier(0.34, 1.56, 0.64, 1) so it gently bobs as it settles up and back down.
```

## Original CSS

```css
.card {
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card:hover {
  transform: translateY(-10px);
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.7);
}
```

## Original React

```jsx
function LiftCard({ children }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: hover ? 'translateY(-10px)' : 'translateY(0)',
        boxShadow: hover ? '0 18px 40px -12px rgba(0,0,0,0.7)' : 'none',
        transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {children}
    </div>
  );
}
```


## Pattern 26

# Sheen Sweep

Pattern 26 of 51 · Surface and Motion Skills

Specular highlight glides across on hover

Source readout: `sheen 0.7s glide`

## Original AI prompt

```text
Add a moving specular sheen to a surface on hover. Use an ::after pseudo-element: a ~50%-wide vertical stripe with a translucent white linear-gradient, skewed by -18deg, positioned off-screen left (left: -60%). On :hover transition its left to 120% over ~0.7s with a glide cubic-bezier(0.16, 1, 0.3, 1) so a glint sweeps across. Keep the parent overflow hidden.
```

## Original CSS

```css
.surface { position: relative; overflow: hidden; }
.surface::after {
  content: "";
  position: absolute;
  top: 0; left: -60%;
  width: 50%; height: 100%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.18), transparent);
  transform: skewX(-18deg);
  transition: left 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.surface:hover::after { left: 120%; }
```

## Original React

```jsx
function Sheen({ children }) {
  return <div className="surface">{children}</div>;
  // ::after is a skewed translucent stripe;
  // :hover slides it from left: -60% to 120%
  // over 0.7s with a glide curve.
}
```


## Pattern 27

# Clip Wipe

Pattern 27 of 51 · Surface and Motion Skills

Overlay unmasks left-to-right with clip-path

Source readout: `clip-path 0.5s`

## Original AI prompt

```text
Stack two layers in a box: a base label and an accent-coloured overlay. Clip the overlay to nothing with clip-path: inset(0 100% 0 0) so only the base shows. On hover, transition the overlay's clip-path to inset(0 0 0 0) over ~0.5s with a glide cubic-bezier(0.16, 1, 0.3, 1) so it wipes in left-to-right. Keep the box overflow hidden.
```

## Original CSS

```css
.over {
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.wipe:hover .over {
  clip-path: inset(0 0 0 0);
}
```

## Original React

```jsx
function ClipWipe({ base, reveal }) {
  const [on, setOn] = useState(false);
  return (
    <div
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      style={{ position: 'relative' }}
    >
      <div>{base}</div>
      <div
        style={{
          position: 'absolute', inset: 0,
          clipPath: on ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
          transition: 'clip-path 0.5s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {reveal}
      </div>
    </div>
  );
}
```


## Pattern 28

# 3D Cube Rotate

Pattern 28 of 51 · Surface and Motion Skills

Click to roll a face in with depth

Source readout: `rotateY spring`

## Original AI prompt

```text
Build a 3D cube you can click to rotate. Use a scene with perspective and a preserve-3d cube whose four side faces are placed with rotateY(0/90/180/-90deg) translateZ(56px). Pull the cube back by translateZ(-56px) so faces sit around the centre. On each click, rotate the cube by -90deg on Y using a spring cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.7s so the next face rolls into view with a slight overshoot.
```

## Original CSS

```css
.scene { perspective: 620px; }
.cube {
  transform-style: preserve-3d;
  transform: translateZ(-56px) rotateY(0deg);
  transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.front { transform: rotateY(0deg)   translateZ(56px); }
.right { transform: rotateY(90deg)  translateZ(56px); }
.back  { transform: rotateY(180deg) translateZ(56px); }
.left  { transform: rotateY(-90deg) translateZ(56px); }
```

## Original React

```jsx
function Cube({ faces }) {
  const [n, setN] = useState(0);
  return (
    <div className="scene" onClick={() => setN(n + 1)}>
      <div
        className="cube"
        style={{ transform: `translateZ(-56px) rotateY(${-90 * n}deg)` }}
      >
        {faces.map((f, i) => (
          <div key={i} className={`face ${f.side}`}>{f.label}</div>
        ))}
      </div>
    </div>
  );
}
```


## Pattern 29

# Jelly Wobble

Pattern 29 of 51 · Surface and Motion Skills

Squash-and-stretch settle on hover

Source readout: `squash & stretch`

## Original AI prompt

```text
Give an element a jelly squash-and-stretch wobble on hover. Run a single ~0.8s keyframe animation with an overshooting spring easing that alternates non-uniform scales: stretch wide and short (1.14, 0.86), then tall and narrow (0.9, 1.1), then progressively smaller corrections until it settles back to scale(1,1). The conservation-of-volume feel (one axis grows as the other shrinks) is what sells it.
```

## Original CSS

```css
.jelly:hover {
  animation: wobble 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes wobble {
  0%   { transform: scale(1, 1); }
  25%  { transform: scale(1.14, 0.86); }
  45%  { transform: scale(0.9, 1.1); }
  65%  { transform: scale(1.05, 0.95); }
  100% { transform: scale(1, 1); }
}
```

## Original React

```jsx
function Jelly({ children }) {
  const [k, setK] = useState(0);
  return (
    <div
      key={k}
      onMouseEnter={() => setK((x) => x + 1)}
      className="jelly"
    >
      {children}
    </div>
  );
  // re-keying restarts the wobble keyframes on each enter
}
```


## Pattern 30

# Folding Doors

Pattern 30 of 51 · Surface and Motion Skills

Two panels swing open in 3D on hover

Source readout: `rotateY 0.6s glide`

## Original AI prompt

```text
Build a content box hidden behind two folding doors. Place an inner layer with the reveal content, then two half-width panels covering it. Give the parent perspective and each panel a transform-origin at its outer edge (left panel: left, right panel: right) with backface-visibility hidden. On hover, swing them open with rotateY(±108deg) over ~0.6s using a glide cubic-bezier(0.16, 1, 0.3, 1).
```

## Original CSS

```css
.fold { perspective: 820px; overflow: hidden; }
.panel {
  backface-visibility: hidden;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.panel.left  { transform-origin: left center; }
.panel.right { transform-origin: right center; }
.fold:hover .panel.left  { transform: rotateY(-108deg); }
.fold:hover .panel.right { transform: rotateY(108deg); }
```

## Original React

```jsx
function FoldReveal({ children }) {
  return (
    <div className="fold">
      <div className="inner">{children}</div>
      <div className="panel left" />
      <div className="panel right" />
    </div>
  );
}
```


## Pattern 31

# Before / After

Pattern 31 of 51 · Surface and Motion Skills

Drag the handle to wipe between layers

Source readout: `drag · clip-path`

## Original AI prompt

```text
Build a before/after image comparison slider. Stack two full-size layers; clip the top (after) layer with clip-path: inset(0 R% 0 0). Dragging a centre handle horizontally sets the percentage so R = 100 - pct, wiping the after layer in and out while a thin vertical divider and round handle track the split. Clamp to 0–100% and update on pointermove while pressed.
```

## Original CSS

```css
.after  { clip-path: inset(0 50% 0 0); }   /* reveal up to the divider */
.divider, .handle { left: 50%; }
/* JS sets:  after.clipPath = `inset(0 ${100 - pct}% 0 0)` */
```

## Original React

```jsx
function Compare({ before, after }) {
  const [pct, setPct] = useState(50);
  const onMove = (e) => {
    if (!e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPct(((e.clientX - r.left) / r.width) * 100);
  };
  return (
    <div className="compare" onPointerMove={onMove}>
      {before}
      <div style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>{after}</div>
      <div className="divider" style={{ left: `${pct}%` }} />
    </div>
  );
}
```


## Pattern 32

# Depth Stack

Pattern 32 of 51 · Surface and Motion Skills

Layered cards fan apart on hover

Source readout: `spring fan-out`

## Original AI prompt

```text
Build a stack of 3 overlapping cards that look like a deck — each lower card pushed down a few px and scaled slightly smaller, with descending z-index. On hover, fan them apart vertically: the top card lifts up and tilts left, the bottom drops and tilts right, the middle squares up to full size. Animate transforms with a spring cubic-bezier(0.34, 1.56, 0.64, 1) over ~0.55s.
```

## Original CSS

```css
.card { transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card:nth-child(2) { transform: translateY(7px)  scale(0.93); }
.card:nth-child(3) { transform: translateY(14px) scale(0.86); }
.stack:hover .card:nth-child(1) { transform: translateY(-48px) rotate(-5deg); }
.stack:hover .card:nth-child(3) { transform: translateY(48px)  rotate(5deg); }
```

## Original React

```jsx
function DepthStack({ cards }) {
  return (
    <div className="stack">
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ zIndex: cards.length - i }}>
          {c}
        </div>
      ))}
    </div>
  );
  // depth via translateY + scale; :hover fans them apart
}
```


## Pattern 33

# Text Wave

Pattern 33 of 51 · Surface and Motion Skills

A crest of motion travels across the letters

Source readout: `sine · 1.5s loop`

## Original AI prompt

```text
Animate a word so a wave of motion travels across its letters. Wrap each character in an inline-block span running the same ~1.5s ease-in-out loop that lifts it ~13px (and tints it the accent colour) at the crest, resting otherwise. Offset each letter with a negative animation-delay stepping by ~0.09s so the peak ripples smoothly left-to-right and never stops.
```

## Original CSS

```css
.wave span {
  display: inline-block;
  animation: bob 1.5s ease-in-out infinite;
}
/* phase each letter with a negative delay so the crest travels */
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  28%      { transform: translateY(-13px); color: #ff8a00; }
}
```

## Original React

```jsx
function TextWave({ text }) {
  return (
    <span className="wave">
      {[...text].map((ch, i) => (
        <span key={i} style={{ animationDelay: `${-i * 0.09}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}
```


## Pattern 34

# Caustic Glass

Pattern 34 of 51 · Surface and Motion Skills

Shifting light pools refract beneath frosted glass

Source readout: `caustic · 9s`

## Original AI prompt

```text
Create a dark frosted-glass panel with slow, uneven pools of amber, blue, and green light moving beneath it. Use oversized blurred radial gradients with different positions so it resembles water caustics rather than an aurora or generic gradient blob.
```

## Original CSS

```css
.caustics::before { background: radial-gradient(...), radial-gradient(...); filter: blur(10px); animation: drift 9s ease-in-out infinite alternate; }
.caustics { backdrop-filter: blur(10px); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 35

# Chromatic Split

Pattern 35 of 51 · Surface and Motion Skills

Type separates into prismatic channels, then snaps back

Source readout: `RGB split · hover`

## Original AI prompt

```text
Make a display word that gets a subtle prismatic RGB split on hover. Duplicate the text with pseudo-elements, offset the blue and red channels by only a few pixels, then use a quick elastic return so it reads like an optical glitch, not a harsh cyberpunk effect.
```

## Original CSS

```css
.chromatic::before, .chromatic::after { content: attr(data-text); position: absolute; }
.chromatic:hover::before { transform: translateX(-3px); color: #5b8def; }
.chromatic:hover::after { transform: translateX(3px); color: #ff5d73; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 36

# Warp Grid

Pattern 36 of 51 · Surface and Motion Skills

A planar field bends inward around its focal point

Source readout: `perspective · hover`

## Original AI prompt

```text
Build a minimal perspective field using two fine repeating-linear-gradient layers. On hover, tip and enlarge the grid toward the viewer while a small central focal point brightens. Keep it architectural and restrained, like a spatial interface rather than a retro wireframe.
```

## Original CSS

```css
.warp-grid { background-size: 18px 18px; transform-style: preserve-3d; }
.warp-grid:hover { transform: rotateX(42deg) rotateZ(-5deg) scale(1.08); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 37

# Moiré Lens

Pattern 37 of 51 · Surface and Motion Skills

Counter-rotating line fields create impossible depth

Source readout: `moiré · counterspin`

## Original AI prompt

```text
Create a restrained moiré lens from two fine repeating radial line fields. Counter-rotate the layers very slowly so interference bands appear to breathe in depth. Mask everything to a rounded dark panel.
```

## Original CSS

```css
.lens, .lens::before { background: repeating-radial-gradient(circle, transparent 0 4px, #777 5px); }
.lens::before { animation: counterspin 12s linear infinite reverse; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 38

# Polarized Foil

Pattern 38 of 51 · Surface and Motion Skills

A muted spectrum appears only at grazing angles

Source readout: `polarize · 11s`

## Original AI prompt

```text
Design a dark polarized foil surface. Keep its spectrum nearly invisible head-on; on hover tilt the panel and sweep a narrow, desaturated conic highlight across it, like security foil seen at a grazing angle.
```

## Original CSS

```css
.foil::before { background: conic-gradient(from var(--angle), ...); mix-blend-mode: screen; }
.foil:hover { transform: perspective(500px) rotateY(-13deg); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 39

# Metaball Bridge

Pattern 39 of 51 · Surface and Motion Skills

Two particles trade mass through a liquid neck

Source readout: `metaball · 4.8s`

## Original AI prompt

```text
Create two glowing particles that repeatedly merge, form a liquid neck, and separate while trading apparent mass. Use blur-plus-contrast metaball compositing inside a clipped dark field; this should read as fluid topology, not a single morphing blob.
```

## Original CSS

```css
.metaballs { filter: blur(7px) contrast(18); }
.metaballs span { animation: exchange 4.8s ease-in-out infinite; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 40

# Variable Weight

Pattern 40 of 51 · Surface and Motion Skills

Type densifies from thin to black on hover

Source readout: `weight · 200→800`

## Original AI prompt

```text
Animate a display word using variable font weight. Idle at weight 200 with open tracking; on hover glide to weight 800 with tighter letter-spacing and a soft amber glow. Prefer a long ease-out curve so the densification feels typographic, not bouncy.
```

## Original CSS

```css
.word {
  font-weight: 200;
  letter-spacing: .04em;
  transition: font-weight .55s cubic-bezier(0.16,1,0.3,1),
              letter-spacing .55s cubic-bezier(0.16,1,0.3,1);
}
.word:hover {
  font-weight: 800;
  letter-spacing: -.02em;
  color: var(--amber);
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 41

# Specular Orbit

Pattern 41 of 51 · Surface and Motion Skills

A soft highlight circles a brushed dark surface

Source readout: `specular · 4.2s`

## Original AI prompt

```text
Design a premium product surface with a slowly orbiting specular highlight. Use a dark brushed panel, a soft radial light that circles with rotate+translate, and a quiet label. Speed up slightly on hover so it feels like the light is responding to attention.
```

## Original CSS

```css
.surface::before {
  width: 86px; height: 86px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.45), transparent 70%);
  animation: orbit 4.2s linear infinite;
}
@keyframes orbit {
  to { transform: rotate(360deg) translateX(46px) rotate(-360deg); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 42

# Noise Dissolve

Pattern 42 of 51 · Surface and Motion Skills

Film grain peels back to uncover a colour field

Source readout: `noise · dissolve`

## Original AI prompt

```text
Create a noise-dissolve reveal panel. Idle state shows restless film grain over a dark surface; on hover the grain softens while a warm gradient blooms underneath, with a monospaced REVEAL label sitting in difference blend so it stays legible through the transition.
```

## Original CSS

```css
.panel::after {
  background-image: url("data:image/svg+xml,...feTurbulence...");
  animation: noise .35s steps(3) infinite;
  mix-blend-mode: overlay;
}
.panel:hover::before { opacity: 1; /* colour field */ }
.panel:hover::after { opacity: .12; }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 43

# Dither Bloom

Pattern 43 of 51 · Surface and Motion Skills

A low-bit dot field grows into a soft spectral bloom

Source readout: `ordered dither · 12fps`

## Original AI prompt

```text
Create a refined ordered-dither surface from a tiny repeating dot grid, not random film grain. Move a soft radial mask across the grid in stepped frames so sparse amber pixels accumulate into a dense spectral bloom, then disperse. Preserve hard pixel edges inside a softly lit panel.
```

## Original CSS

```css
.dither::before {
  background: radial-gradient(circle, #ff8a00 0 1px, transparent 1.5px);
  background-size: 7px 7px;
  mask-image: radial-gradient(circle at var(--x) var(--y), #000, transparent 62%);
  animation: dither-drift 6s steps(12) infinite;
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 44

# Ferrofluid Crown

Pattern 44 of 51 · Surface and Motion Skills

A magnetic core raises a ring of liquid-metal spikes

Source readout: `ferrofluid · 18 spikes`

## Original AI prompt

```text
Make a dark ferrofluid crown: a glossy circular core surrounded by irregular magnetic spikes that lengthen and rotate as if a field is passing around them. Use one clipped polygon with layered specular highlights; avoid ordinary blob morphing or a simple radial pulse.
```

## Original CSS

```css
.ferrofluid::before {
  clip-path: polygon(50% 0%, 56% 30%, 72% 7%, 70% 34%, 94% 20%, 76% 42%, 100% 50%, 76% 58%, 94% 80%, 70% 66%, 72% 93%, 56% 70%, 50% 100%, 44% 70%, 28% 93%, 30% 66%, 6% 80%, 24% 58%, 0 50%, 24% 42%, 6% 20%, 30% 34%, 28% 7%, 44% 30%);
  animation: ferro-pull 3.8s ease-in-out infinite;
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 45

# Lenticular Shift

Pattern 45 of 51 · Surface and Motion Skills

Micro-ridges swap one word for another as the angle changes

Source readout: `lenticular · hover`

## Original AI prompt

```text
Build a lenticular type panel that alternates between MATTER and MOTION through fine vertical ridges. Interleave the second word with narrow mask strips, then shift the layers in opposite directions on hover so the perceived label changes with viewing angle rather than crossfading.
```

## Original CSS

```css
.lenticular span::before,
.lenticular span::after { position: absolute; content: attr(data-a); }
.lenticular span::after {
  content: attr(data-b);
  mask: repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 12px);
}
.lenticular:hover span { transform: skewY(-5deg) translateX(3px); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 46

# Volumetric Shaft

Pattern 46 of 51 · Surface and Motion Skills

Light rakes through a slot and pools in drifting dust

Source readout: `volumetric · 9s drift`

## Original AI prompt

```text
Render god rays falling through an unseen window into a dark room. Build the shafts from a repeating angled gradient, soften them with a small blur, and mask them so they fade out before they reach the floor. Slowly rake the whole bundle back and forth as if the sun were moving, drift a few dust motes across at a different speed, and let a warm pool brighten on the floor exactly where the shafts land.
```

## Original CSS

```css
.volumetric span {
  background: repeating-linear-gradient(97deg,
    transparent 0 12px, rgba(255,180,90,.16) 13px 22px);
  -webkit-mask: radial-gradient(60% 90% at 50% 0%, #000, transparent 72%);
  filter: blur(1.5px);
  animation: shaft-rake 9s ease-in-out infinite alternate;
}
@keyframes shaft-rake {
  from { transform: skewX(-9deg) translateX(-14px); opacity: .55; }
  to   { transform: skewX(3deg)  translateX(14px);  opacity: 1; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 47

# Letterpress Emboss

Pattern 47 of 51 · Surface and Motion Skills

Type sits in the paper and reads by the light angle alone

Source readout: `deboss · light 7s`

## Original AI prompt

```text
Make type look physically stamped into warm paper. The glyphs themselves are nearly transparent — legibility comes only from a pale highlight on one side and a warm shadow on the other. Rotate that light source slowly so the relief reverses direction, and on hover deepen the impression by pressing the letters a fraction smaller with stronger contrast. Add a fine paper grain, no drop shadows on the panel.
```

## Original CSS

```css
.letterpress span {
  color: transparent;
  background: linear-gradient(#00000012, #00000004);
  -webkit-background-clip: text;
  text-shadow:
    calc(var(--lx) * 1px) calc(var(--ly) * 1px) 1px rgba(255,255,255,.85),
    calc(var(--lx) * -1px) calc(var(--ly) * -1px) 2px rgba(60,40,20,.42);
  animation: press-light 7s ease-in-out infinite alternate;
}
.letterpress:hover span { scale: .992; filter: contrast(1.15); }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 48

# Rack Focus

Pattern 48 of 51 · Surface and Motion Skills

Depth of field pulls between two planes, bokeh blooming

Source readout: `f/1.8 · focus pull`

## Original AI prompt

```text
Simulate a cinematic focus pull between two depth planes. Only one plane is ever sharp: as the near label resolves, the far label blurs, dims and grows fractionally, then they trade with an in-out curve on a slow loop. Bokeh circles behind them should swell and brighten exactly when their plane goes soft. Use blur, opacity and scale together — a plain crossfade will not read as a lens.
```

## Original CSS

```css
.rack-near { animation: pull-near 7.4s cubic-bezier(.65,0,.35,1) infinite; }
.rack-far  { animation: pull-far  7.4s cubic-bezier(.65,0,.35,1) infinite; }
@keyframes pull-near {
  0%, 34%   { filter: blur(0);   opacity: 1;   scale: 1; }
  50%, 84%  { filter: blur(6px); opacity: .42; scale: 1.03; }
  100%      { filter: blur(0);   opacity: 1;   scale: 1; }
}
@keyframes pull-far { /* exact inverse — only one plane is ever sharp */ }
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 49

# E-ink Refresh

Pattern 49 of 51 · Surface and Motion Skills

A full inverse flash, then the type settles into the paper

Source readout: `eink · flash 5.2s`

## Original AI prompt

```text
Simulate an electrophoretic e-ink refresh. The paper goes fully black for a beat (the classic inverse flash), then the word appears slightly offset and high-contrast before settling into the grain. Add a fine dither on the paper. This is not a fade-in — the flash is what makes it read as e-ink.
```

## Original CSS

```css
.eink i { animation: eink-flash 5.2s steps(1) infinite; }
.eink span { animation: eink-settle 5.2s ease-out infinite; }
@keyframes eink-flash {
  0%, 8%   { opacity: 0; }
  10%, 18% { opacity: 1; }   /* black frame */
  20%, 100%{ opacity: 0; }
}
@keyframes eink-settle {
  0%, 18% { opacity: 0; letter-spacing: .22em; filter: contrast(3); }
  24%     { opacity: 1; transform: translate(1px,-1px); }
  36%,100%{ opacity: 1; transform: none; letter-spacing: .08em; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 50

# Anamorphic Flare

Pattern 50 of 51 · Surface and Motion Skills

A point source rakes the frame and blooms horizontal streaks

Source readout: `anamorphic · 6.4s`

## Original AI prompt

```text
Build a cinematic anamorphic lens flare. A small white point travels across a black frame. As it crosses centre, a long horizontal streak blooms — cool blue one side, warm amber the other — plus two faint oval artifacts offset on the same axis. Soften with a 1px blur. This is a lens, not a shine sweep or a god-ray shaft.
```

## Original CSS

```css
.flare b { animation: flare-travel 6.4s cubic-bezier(.65,0,.35,1) infinite; }
.flare i,
.flare em { animation: flare-bloom 6.4s ease-in-out infinite; }
@keyframes flare-travel {
  0%   { translate: -80px 0; }
  100% { translate:  80px 0; }
}
@keyframes flare-bloom {
  0%, 100% { opacity: .15; transform: scaleX(.4); }
  50%      { opacity: 1;   transform: scaleX(1); }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.


## Pattern 51

# LiDAR Sweep

Pattern 51 of 51 · Surface and Motion Skills

A scan plane lights a point field into a depth map

Source readout: `lidar · plane 6s`

## Original AI prompt

```text
Render a LiDAR sweep over a 5 by 4 point field. A thin cool scan plane travels top to bottom. Each row of points ignites as the plane crosses it — they lift a few pixels to imply depth, glow, then dim after the plane has passed. Vary the lift per column so the field reads as terrain, not a flat grid. This is a depth scan, not a radar ping.
```

## Original CSS

```css
.lidar-plane { animation: lidar-plane 6s cubic-bezier(.65,0,.35,1) infinite; }
.lidar-field i { animation: lidar-hit 6s cubic-bezier(.16,1,.3,1) infinite; }
.lidar-field i:nth-child(n+6)  { animation-delay: .42s; }
.lidar-field i:nth-child(n+11) { animation-delay: .84s; }
@keyframes lidar-hit {
  0%, 12% { opacity: .18; transform: translateY(0) scale(.7); }
  22%, 70%{ opacity: 1;   transform: translateY(var(--lift, -6px)) scale(1); }
  88%,100%{ opacity: .18; transform: none; }
}
```

## Original React

Not supplied by upstream for this pattern. Use the CSS and prompt to implement it in the target framework.

