import { motion } from "motion/react";

export function HeaderBar() {
  return (
    <header className="topbar topbar-olympus">
      <div className="brand-block olympus-brand-block">
        <motion.div
          className="olympus-sigil-shell"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <OlympusSigil />
        </motion.div>

        <motion.h1
          className="olympus-wordmark"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        >
          OLYMPUS
        </motion.h1>
      </div>
    </header>
  );
}

function OlympusSigil() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="olympus-sigil">
      <circle
        cx="28"
        cy="28"
        r="26"
        stroke="#d97706"
        strokeWidth="0.6"
        opacity="0.25"
        className="olympus-sigil-ring outer"
      />
      <circle cx="28" cy="28" r="19" stroke="#d97706" strokeWidth="0.5" opacity="0.45" />
      <text
        x="28"
        y="37"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontSize="26"
        fontWeight="500"
        fill="#d97706"
        className="olympus-sigil-glyph"
      >
        Ω
      </text>
    </svg>
  );
}
