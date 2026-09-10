# Live Command fit — September 9, 2026

The live dial previously applied a 1.12 CSS scale to its responsive square. This pass reduces that to 0.896 (20% smaller). The study retains 1.4. Internal project geometry, materials, constellation layout, camera, and centering are unchanged.

The opaque scene background was already removed in earlier work. The current renderer requests alpha, clears to transparent black, and leaves scene.background unset. Installed Three.js bloom derives alpha from bloom intensity, and OutputPass retains alpha. Browser inspection found transparent backgrounds on the panel, instrument, dial, core, layer, and canvas. No extra mask or backing overlay is needed.

Live-shell browser inspection at 1256×856 measured a 582.4-pixel dial inside the command column, with clear spacing from navigation, rail, and console. Screenshot confirmed page art visible around and through the apparatus with no rectangular stage. Browser preview has no vault backend, so it cannot validate real vault constellations. Study fixture validation and desktop validation are distinct. This CSS change has not been installed.
