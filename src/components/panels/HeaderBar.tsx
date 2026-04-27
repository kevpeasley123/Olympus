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
          <svg width="280" height="280" viewBox="0 0 280 280" fill="none" className="olympus-sigil-backdrop-svg">
            <g className="ring-outer" style={{ transformOrigin: "140px 140px" }}>
              <circle
                cx="140"
                cy="140"
                r="135"
                stroke="#d97706"
                strokeWidth="0.8"
                opacity="0.4"
                fill="none"
              />
            </g>
            <g className="ring-middle" style={{ transformOrigin: "140px 140px" }}>
              <circle
                cx="140"
                cy="140"
                r="116"
                stroke="#d97706"
                strokeWidth="0.6"
                opacity="0.45"
                fill="none"
              />
            </g>
            <g className="ring-inner" style={{ transformOrigin: "140px 140px" }}>
              <circle
                cx="140"
                cy="140"
                r="97"
                stroke="#d97706"
                strokeWidth="0.6"
                opacity="0.5"
                fill="none"
              />
            </g>
            <text
              x="140"
              y="192"
              textAnchor="middle"
              fontFamily="'Cinzel', 'Times New Roman', serif"
              fontSize="180"
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
