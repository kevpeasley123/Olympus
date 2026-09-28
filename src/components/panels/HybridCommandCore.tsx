import { useEffect, useMemo, useRef } from "react";
import "@fontsource/jetbrains-mono/500.css";
import type { CommandLayout } from "../../services/hybridCore";
import type { OlympusVisualState } from "../../services/ambientMotion";
export interface HybridFrame { state: OlympusVisualState; voiceLevel: number; running: boolean; hoverProject: string | null; execution?: { projectId: string; operation: number }; constellationMotion?: {yaw:number} }
interface Props extends HybridFrame { layout: CommandLayout; onReady: (ready: boolean) => void; onError: (reason: string) => void }
/**
 * Only what mountHybridScene and the material study read. The layout embeds
 * whole projects (commits, repo state) and a continuously varying label scale;
 * keying on all of it rebuilt the WebGL context on every scan and resize.
 */
function sceneKeyFor(layout: CommandLayout) {
  const end = (p: {x:number; y:number; id?:string}) => p.id ?? `${p.x},${p.y}`;
  return JSON.stringify([
    Math.round(layout.labelScale * 20) / 20,
    layout.ring.segments.map(s => [s.project.id, s.project.name, s.project.status, s.startAngle, s.endAngle, s.midAngle]),
    layout.constellation.nodes.map(n => [n.id, n.projectId, n.isProject, n.x, n.y, n.size]),
    layout.constellation.treeEdges.map(e => [end(e.from), end(e.to), e.depth]),
    layout.constellation.crossProjectEdges.map(e => [end(e.from), end(e.to), e.pieces.map(p => [p.from.x, p.from.y, p.to.x, p.to.y])]),
  ]);
}
export function HybridCommandCore(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const motion = useRef({yaw:0});
  const latest = useRef(props); latest.current = {...props,constellationMotion:motion.current};
  const activeScene = useRef<{dispose:()=>void; layer:HTMLDivElement}|null>(null);
  // Polling can create new layout objects without changing a single mesh.
  const sceneKey = useMemo(() => sceneKeyFor(props.layout), [props.layout]);
  useEffect(() => {
    let cancelled = false, installed = false;
    let dispose: (() => void) | undefined;
    const layer = document.createElement("div");
    layer.className = "hybrid-core__layer";
    layer.style.visibility = "hidden";
    host.current?.appendChild(layer);
    void import("../../services/hybridScene").then(async ({mountHybridScene})=>{
      await document.fonts.load('500 12px "JetBrains Mono"');
      if(cancelled || !host.current)return;
      dispose=mountHybridScene(layer,latest.current.layout,()=>latest.current,()=>{
        if(cancelled)return;
        const previous=activeScene.current;
        layer.style.visibility="visible";
        activeScene.current={dispose:()=>dispose?.(),layer};
        installed=true;
        previous?.dispose();previous?.layer.remove();
        latest.current.onReady(true);
      },reason=>{
        if(cancelled && activeScene.current?.layer!==layer)return;
        latest.current.onError(reason);
        latest.current.onReady(false);
      });
    }).catch(error=>{
      if(cancelled)return;
      console.error("[Olympus] Command instrument initialization failed",error);
      latest.current.onError(import.meta.env.DEV && error instanceof Error
        ? `Rendering initialization failed: ${error.message}`
        : "Rendering initialization failed.");
    });
    return ()=>{
      cancelled=true;
      // Retain the completed scene until its replacement has painted.
      if(!installed){dispose?.();layer.remove();}
    };
  },[sceneKey]);
  useEffect(()=>()=>{activeScene.current?.dispose();activeScene.current?.layer.remove();activeScene.current=null;},[]);
  return <div ref={host} className="hybrid-core" aria-hidden="true" />;
}
