import './zeusLightning.css';

// Decorative identity, not an indication that Zeus is executing a mission.
// Broken, branching channels leave open space around the central bolt.
const channels = [
  'M8 21 5 17 9 16 7 12 12 13 11 8 16 10 18 5 21 8 26 5 25 10 31 8',
  'M29 9 34 12 31 14 37 16 33 19 38 23 34 24 36 29 31 28 32 33 27 31',
  'M29 33 24 37 23 33 18 38 17 34 12 35 13 30 8 31 10 26 6 25 8 21',
];
const forks = ['m11 8 2-4 3 1', 'M37 16l3-1-1-3', 'M18 38l-3 3-2-2 M8 31l-4 1 1-4'];

export function ZeusLightning() {
  return <svg className="zeus-lightning" viewBox="0 0 44 44" fill="none" aria-hidden="true" focusable="false">
    <g className="zeus-lightning__orbit">
      {channels.map((d, i) => <g key={d} className={`zeus-lightning__channel zeus-lightning__channel--${i}`}>
        <path className="zeus-lightning__glow" pathLength="100" d={d}/>
        <path className="zeus-lightning__core" pathLength="100" d={d}/>
        <path className="zeus-lightning__forks" d={forks[i]}/>
      </g>)}
    </g>
  </svg>;
}
