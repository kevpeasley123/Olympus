import type { AmbientEvent } from "../../services/ambientMotion";

/** Decorative tracks only. Never wrap project geometry or intercept its hit targets. */
export function AmbientOrbits({ centre, events, complete }: { centre: number; events: Record<AmbientEvent, number>; complete: boolean }) {
  return <g className="ambient-orbits" aria-hidden="true" pointerEvents="none">
    {complete && <circle className="ambient-completion" cx={centre} cy={centre} r={80} />}
    <g className="ambient-orbit ambient-orbit--outer">
      <circle cx={centre} cy={centre} r={194} className="ambient-track" />
      <circle cx={centre} cy={centre - 194} r={1.25} className="ambient-marker" />
    </g>
    <g className="ambient-orbit ambient-orbit--secondary">
      <circle cx={centre} cy={centre} r={190} className="ambient-ticks" strokeDasharray="1 31 3 52" />
      <circle cx={centre} cy={centre} r={190} className="ambient-accent" strokeDasharray="6 1188" />
    </g>
    {events.sweep > 0 && <g key={`sweep-${events.sweep}`} className="ambient-sweep">
      <circle cx={centre} cy={centre} r={80} className="ambient-energy" strokeDasharray="30 473" />
    </g>}
    {events.tracer > 0 && <g key={`tracer-${events.tracer}`} className="ambient-tracer">
      {[0, 1, 2, 3, 4].map(i => <circle key={i} cx={centre} cy={centre} r={194}
        className="ambient-tail" strokeDasharray="7 1212" strokeDashoffset={(i + 1) * 7} opacity={0.5 - i * 0.09} />)}
      <circle cx={centre + 194} cy={centre} r={1.35} className="ambient-tracer-head" />
    </g>}
    {events.micro > 0 && <g key={`micro-${events.micro}`} transform={`rotate(${(events.micro * 137.508) % 360} ${centre} ${centre})`}>
      <circle cx={centre} cy={centre} r={190} className="ambient-micro" strokeDasharray="10 1184" />
    </g>}
  </g>;
}
