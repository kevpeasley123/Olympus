import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Mission } from './services/capabilities';
import { FIGURE_HEIGHT, buildPantheonFigures } from './services/pantheonFigures';
import { PANTHEON_FIGURES } from './services/pantheonFigureState';
import { SCENE_FINISH } from './services/hybridScene';
import { setPantheonSkin, type SkinId } from './services/pantheonSkins';
import { setAgentHighlight } from './services/agentConstellation';

/**
 * Pantheon figure harness: the gods close up, under Command's lights, camera
 * and bloom, for checking models and clips. `?god=athena` frames one god (all
 * five otherwise); `&state=working|waiting|blocked` records a synthetic step
 * for every agent; `&pose=hold` stops the clock; `&at`, `&dist` and `&turn` move the camera;
 * `&skin=aged-bronze|obsidian-gold|mythic|celestial` picks the skin and `&hover=athena`
 * holds the pointer over a god. Nothing here touches live data.
 * `<html data-figures-ready>` is set once every statue has loaded.
 */
const params = new URLSearchParams(location.search);
const god = PANTHEON_FIGURES.find(f => f.id === params.get('god'));
const state = params.get('state') ?? 'idle';
if (params.get('skin')) setPantheonSkin(params.get('skin') as SkinId);
const hovered = PANTHEON_FIGURES.find(f => f.id === params.get('hover'));
if (hovered) setAgentHighlight({}, hovered.agent);
const host = document.getElementById('stage') as HTMLDivElement;
const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);
const scene = new T.Scene();
scene.add(new T.HemisphereLight(0xc5e2ff, 0x07121f, .65));
const light = new T.DirectionalLight(0xddefff, 2.1); light.position.set(-100, 160, 230); scene.add(light);
const warm = new T.PointLight(0xff8a2a, 160, 380, 1); warm.position.set(20, -20, 100); scene.add(warm);
const camera = new T.PerspectiveCamera(god ? 30 : 43, 1, 1, 2000);
const main = new T.Vector3(-85, 40, 700);
if (god) {
  // `&at=` is the framed height as a fraction of the figure, `&dist=` the camera distance, `&turn=` an orbit in radians.
  const centre = new T.Vector3(...god.station).add(new T.Vector3(0, FIGURE_HEIGHT * Number(params.get('at') ?? .5), 0));
  const offset = main.clone().sub(centre).setLength(Number(params.get('dist') ?? 210)).applyAxisAngle(new T.Vector3(0, 1, 0), Number(params.get('turn') ?? 0));
  camera.position.copy(centre).add(offset); camera.lookAt(centre);
} else { camera.position.copy(main); camera.lookAt(0, -24, 0); }
const figures = buildPantheonFigures(scene, host, camera, renderer);
(window as unknown as { pantheonScene: T.Scene }).pantheonScene = scene;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new T.Vector2(512, 512), SCENE_FINISH.bloom.strength, SCENE_FINISH.bloom.radius, SCENE_FINISH.bloom.threshold));
composer.addPass(new OutputPass());
const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
resize(); addEventListener('resize', resize);
const started = new Date(Date.now() - 134_000).toISOString();
const missions: Mission[] = state === 'idle' ? [] : [{
  id: 'harness', kind: 'coding-delegation', workflow: 'harness', title: 'Harness', request: '', status: state === 'waiting' ? 'waiting' : 'running', startedAt: started, finishedAt: null,
  steps: PANTHEON_FIGURES.map(f => ({ id: f.id, label: `${f.name} step`, state: state === 'blocked' ? 'failed' : 'active', recorded: null, agent: f.agent, tools: [], skills: [] })),
  approval: null, result: null, destination: 'project', source: 'harness',
}];
const timer = new T.Timer();
let time = 0;
const frozen = params.get('pose') === 'hold';
function frame(now?: number) {
  timer.update(now);
  const delta = frozen ? 0 : Math.min(timer.getDelta(), .1);
  time += delta;
  figures.update(missions, null, delta, time, !frozen);
  composer.render();
  const statues = PANTHEON_FIGURES.every(f => scene.getObjectByName(`${f.name} statue`));
  if (statues) document.documentElement.dataset.figuresReady = 'true';
  requestAnimationFrame(frame);
}
frame();
