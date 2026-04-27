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
          <svg width="260" height="260" viewBox="0 0 260 260" fill="none" className="olympus-sigil-backdrop-svg">
            <circle
              cx="130"
              cy="130"
              r="125"
              stroke="#d97706"
              strokeWidth="0.6"
              opacity="0.25"
              className="olympus-ring-outer"
            />
            <circle cx="130" cy="130" r="108" stroke="#d97706" strokeWidth="0.5" opacity="0.3" />
            <circle cx="130" cy="130" r="90" stroke="#d97706" strokeWidth="0.5" opacity="0.35" />
            <text
              x="130"
              y="178"
              textAnchor="middle"
              fontFamily="'Cinzel', 'Times New Roman', serif"
              fontSize="170"
              fontWeight="500"
              fill="#d97706"
              opacity="0.32"
            >
              {"\u03A9"}
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
