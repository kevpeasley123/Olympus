import { useEffect, useRef } from "react";
import { setHybridEnabled, useHybridEnabled, type CommandLayout } from "../../services/hybridCore";
import type { OlympusVisualState } from "../../services/ambientMotion";
export interface HybridFrame { state: OlympusVisualState; voiceLevel: number; running: boolean; hoverProject: string | null; execution?: { projectId: string; operation: number } }
interface Props extends HybridFrame { layout: CommandLayout; onReady: (ready: boolean) => void; onError: (reason: string) => void }
export function HybridCoreSetting() {
  const enabled = useHybridEnabled();
  return <label className="hybrid-setting"><input type="checkbox" checked={enabled} onChange={e => setHybridEnabled(e.target.checked)} />
    <span>Dimensional core <small>3D rendering · session control</small></span></label>;
}
export function HybridCommandCore(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef<HybridFrame>(props); latest.current = props;
  const { layout, onReady, onError } = props;
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    onReady(false);
    void import("../../services/hybridScene").then(({ mountHybridScene }) => {
      if (cancelled || !host.current) return;
      dispose = mountHybridScene(host.current, layout, () => latest.current, () => onReady(true), onError);
    }).catch(() => { if (!cancelled) onError("Rendering initialization failed."); });
    return () => { cancelled = true; dispose?.(); onReady(false); };
  }, [layout, onReady, onError]);
  return <div ref={host} className="hybrid-core" aria-hidden="true" />;
}
