# Command renderer lifecycle

Development fix after installed 0.11.1, September 9, 2026.

Command uses only the 3D core. The old SVG Omega/orbits and renderer preference have been removed. SVG labels and interaction targets remain aligned with the 3D apparatus; they are not a fallback renderer.

Command stays mounted across Project/Research navigation. Hidden dimensions do not shrink or clear its canvas, and hidden scenes stop rendering. Equivalent polling layouts do not rebuild meshes. Changed layouts retain the completed scene until its replacement paints. Initial loading and graphics errors hide the coordinated scene and labels; graphics failures offer Retry 3D view instead of legacy artwork.

Validation: TypeScript/Vite production build and 28 browser harness checks pass, including context loss, retry, missing WebGL, reduced motion, and hidden-view rendering. Browser Command/Project/Research round trip retained one canvas and its frame counter, then restored the complete apparatus. No installed WebView validation yet; this fix has not been packaged or installed.
