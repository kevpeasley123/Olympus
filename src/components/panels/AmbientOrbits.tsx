import type { AmbientEvent } from "../../services/ambientMotion";

/** Decorative tracks only. Never wrap project geometry or intercept its hit targets. */
export function AmbientOrbits({ centre, events, complete }: { centre: number; events: Record<AmbientEvent, number>; complete: boolean }) {
  return <g className="ambient-orbits" aria-hidden="true" pointerEvents="none">
    {complete && <circle className="ambient-completion" cx={centre} cy={centre} r={80} />}
    <g className="ambient-orbit ambient-orbit--outer">
      <circle cx={centre} cy={centre} r={194} className="ambient-track" />
      <circle cx={centre} cy={centre} r={194} className="ambient-orbit-wake" strokeDasharray="100 1119" transform={`rotate(-120 ${centre} ${centre})`} />
      <circle cx={centre} cy={centre - 194} r={2.5} className="ambient-marker" />
    </g>
    <g className="ambient-orbit ambient-orbit--secondary">
      <circle cx={centre} cy={centre} r={190} className="ambient-ticks" strokeDasharray="1 31 3 52" />
      <circle cx={centre} cy={centre} r={190} className="ambient-accent" strokeDasharray="64 1130" />
    </g>
    <g className="ambient-inner-axis ambient-inner-axis--0">
      <g className="ambient-inner ambient-inner--primary">
        <circle cx={centre} cy={centre} r={84} className="ambient-energy" />
      </g>
    </g>
    <g className="ambient-inner-axis ambient-inner-axis--1">
      <g className="ambient-inner ambient-inner--secondary">
        <circle cx={centre} cy={centre} r={94} className="ambient-energy" />
      </g>
    </g>
    {events.sweep > 0 && <g key={`sweep-${events.sweep}`} className="ambient-inner-burst">
      {[104, 114, 124].map((radius, index) => <g key={radius}
        className={`ambient-inner-axis ambient-inner-axis--${index + 2}`}>
        <g className={`ambient-inner ambient-inner--extra ambient-inner--extra-${index}`}>
          <circle cx={centre} cy={centre} r={radius} className="ambient-energy" />
        </g>
      </g>)}
    </g>}
    {events.tracer > 0 && <g key={`tracer-${events.tracer}`} className="ambient-tracer">
      {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={centre} cy={centre} r={194}
        className="ambient-tail" strokeDasharray="14 1205" strokeDashoffset={(i + 1) * 14} opacity={0.85 - i * 0.16} />)}
      <circle cx={centre + 194} cy={centre} r={2.8} className="ambient-tracer-head" />
    </g>}
    {events.micro > 0 && <g key={`micro-${events.micro}`} transform={`rotate(${(events.micro * 137.508) % 360} ${centre} ${centre})`}>
      <circle cx={centre} cy={centre} r={190} className="ambient-micro" strokeDasharray="30 1164" />
    </g>}
  </g>;
}
