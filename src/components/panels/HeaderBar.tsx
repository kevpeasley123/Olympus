import { motion } from "motion/react";

export function HeaderBar() {
  return (
    <header className="topbar olympus-header">
      <div className="olympus-emblem-stack">
        <motion.div
          className="olympus-sigil-backdrop"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          aria-hidden="true"
        >
          <svg width="220" height="220" viewBox="0 0 220 220" fill="none" className="olympus-sigil-backdrop-svg">
            <circle
              cx="110"
              cy="110"
              r="108"
              stroke="#d97706"
              strokeWidth="0.5"
              opacity="0.15"
              className="olympus-ring-outer"
            />
            <circle cx="110" cy="110" r="92" stroke="#d97706" strokeWidth="0.4" opacity="0.2" />
            <circle cx="110" cy="110" r="76" stroke="#d97706" strokeWidth="0.4" opacity="0.25" />
            <text
              x="110"
              y="155"
              textAnchor="middle"
              fontFamily="Cinzel, serif"
              fontSize="180"
              fontWeight="500"
              fill="#d97706"
              opacity="0.18"
            >
              Ω
            </text>
          </svg>
        </motion.div>

        <motion.h1
          className="olympus-wordmark"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
        >
          OLYMPUS
        </motion.h1>
      </div>
    </header>
  );
}
