/**
 * Visual preview harness: `/depth-preview.html` on the dev server. Mounts the
 * real ProjectRing with a fixture graph shaped like today's vault — Olympus
 * with a populated two-row band, everyone else empty or lightly populated — so
 * segment and node rendering can be screenshotted headlessly with nodes
 * present, which the browser dev server cannot otherwise show (no Tauri, no
 * graph). Purely a viewing surface: it asserts nothing and ships nowhere.
 *
 * Fixture builders are mirrored from `projectRing.harness.ts` verbatim,
 * `notePath` included — a reconstruction that omits it positions nothing while
 * throwing no error.
 */
import { createRoot } from "react-dom/client";
import { ProjectRing } from "./components/panels/ProjectRing";
import type { VaultGraphPayload } from "./services/vaultGraph";
import type { ProjectStatus, TrackedProject } from "./types";
import "@fontsource/cinzel/500.css";
import "@fontsource/inter/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";

function project(
  id: string,
  name: string,
  status: ProjectStatus,
  notePath = `01 - Projects/${name}.md`
): TrackedProject {
  return {
    id,
    name,
    path: `C:\\Projects\\${name}`,
    status,
    statusSource: status === "unclassified" ? "inferred" : "declared",
    promoted: null,
    branch: "main",
    lastCommit: "abc1234 Test commit",
    lastCommitAt: "2026-07-28T12:00:00-07:00",
    repoState: "git-active",
    recentCommits: [],
    sinceSessionCommits: [],
    linkedWorktrees: [],
    summary: "",
    vision: "",
    visionReviewedAt: null,
    nextStep: "",
    notePath,
    warnings: []
  };
}

function payload(
  nodes: VaultGraphPayload["nodes"],
  edges: VaultGraphPayload["edges"]
): VaultGraphPayload {
  return {
    nodes,
    edges,
    projectCount: nodes.filter((node) => node.isProject).length,
    connectedProjectCount: nodes.filter((node) => node.isProject && node.degree > 0).length,
    hopOneCount: nodes.filter((node) => node.hop === 1).length,
    dropped: 0,
    droppedLinked: 0,
    excludedScaffold: 0,
    brokenLinks: 0
  };
}

const projects: TrackedProject[] = [
  project("agentic-ai", "Agentic AI", "scaffold"),
  project("ai-learning", "AI Learning", "scaffold"),
  project("fidelity", "Fidelity", "unclassified"),
  project("fruit-organizer", "Fruit Organizer", "unclassified"),
  project("health-app", "Health App", "unclassified"),
  project("obsidian", "Obsidian", "watching"),
  project("olympus", "Olympus", "active"),
  project("pokedex", "Pokedex", "watching")
];

// Today's real shape: one populated wedge at the sub-row ceiling, one deeper
// chain, everything else empty territory.
const nodes: VaultGraphPayload["nodes"] = [];
const edges: VaultGraphPayload["edges"] = [];
const olympus = projects.find((candidate) => candidate.id === "olympus")!;
nodes.push({
  id: olympus.notePath!,
  title: olympus.name,
  folder: "01 - Projects",
  hop: 0,
  isProject: true,
  degree: 14
});
for (let index = 0; index < 14; index += 1) {
  const id = `02 - Research/olympus-note-${index}.md`;
  nodes.push({
    id,
    title: `Olympus note ${index}`,
    folder: "02 - Research",
    hop: 1,
    isProject: false,
    degree: index < 2 ? 2 : 1
  });
  edges.push({ from: olympus.notePath!, to: id });
}
for (let depth = 2; depth <= 3; depth += 1) {
  const id = `02 - Research/olympus-depth-${depth}.md`;
  nodes.push({
    id,
    title: `Olympus depth ${depth}`,
    folder: "02 - Research",
    hop: depth,
    isProject: false,
    degree: 1
  });
  edges.push({
    from: depth === 2 ? "02 - Research/olympus-note-0.md" : "02 - Research/olympus-depth-2.md",
    to: id
  });
}

const SIZE = 440;
const root = createRoot(document.getElementById("preview")!);
root.render(
  <div
    style={{
      width: 754,
      height: 754,
      background: "radial-gradient(circle at 50% 42%, #101b29 0%, #060b13 70%)",
      display: "grid",
      placeItems: "center"
    }}
  >
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={754} height={754} data-render-scale="1.714">
      <ProjectRing
        centre={SIZE / 2}
        radius={168}
        projects={projects}
        graph={payload(nodes, edges)}
        tasks={[]}
        tasksError={null}
        renderScale={1.714}
        onSelectProject={() => {}}
        onOpenNote={() => {}}
      />
    </svg>
  </div>
);
