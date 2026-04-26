import { Pause, Play } from "lucide-react";
import type { NowPlayingSnapshot } from "../../types";

interface NowPlayingPanelProps {
  nowPlaying: NowPlayingSnapshot;
}

export function NowPlayingPanel({ nowPlaying }: NowPlayingPanelProps) {
  return (
    <section className="dashboard-panel now-playing-panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Now Playing</p>
          <h2>{nowPlaying.source}</h2>
        </div>
        <span className={`now-playing-state ${nowPlaying.status}`}>
          {nowPlaying.status === "playing" ? <Play size={12} /> : <Pause size={12} />}
          {nowPlaying.status}
        </span>
      </div>
      <div className="now-playing-body">
        <strong>{nowPlaying.track}</strong>
        <p>{nowPlaying.artist}</p>
        <small>{nowPlaying.detail}</small>
      </div>
    </section>
  );
}
