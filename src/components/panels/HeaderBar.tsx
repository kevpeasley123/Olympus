import { motion } from "motion/react";

export function HeaderBar() {
  return (
    <header className="topbar olympus-header">
      <motion.div
        className="olympus-emblem-stack"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
        aria-hidden="true"
      >
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="olympus-sigil-svg">
          <g className="ring-outer" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="48" stroke="#d97706" strokeWidth="0.4" opacity="0.25" fill="none" />
          </g>
          <g className="ring-middle" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="41" stroke="#d97706" strokeWidth="0.4" opacity="0.30" fill="none" />
          </g>
          <g className="ring-inner" style={{ transformOrigin: "50px 50px" }}>
            <circle cx="50" cy="50" r="34" stroke="#d97706" strokeWidth="0.4" opacity="0.35" fill="none" />
          </g>
          <text
            x="50"
            y="68"
            textAnchor="middle"
            fontFamily="'Cinzel', 'Times New Roman', serif"
            fontSize="64"
            fontWeight="500"
            fill="#d97706"
            opacity="0.85"
          >
            {"Ω"}
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
    </header>
  );
}
