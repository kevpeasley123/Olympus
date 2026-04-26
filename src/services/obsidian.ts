import { invoke } from "@tauri-apps/api/core";
import type { ResearchRecord, TrackedProject } from "../types";
import { categoryLabel } from "./pantheonAnalysis";

type ActionTone = "success" | "warning" | "error";

export interface ObsidianActionResult {
  tone: ActionTone;
  message: string;
  path?: string;
}

interface WriteMemoryArtifactResult {
  path: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function yamlText(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlBlockText(value: string): string {
  const normalized = value.trim().replace(/\r\n/g, "\n");
  if (!normalized) return '""';
  const indented = normalized.split("\n").map((line) => `  ${line}`).join("\n");
  return `|-\n${indented}`;
}

function projectNoteName(projectName: string): string {
  return sanitizeFileName(projectName) || "Untitled Project";
}

function createResearchMarkdown(record: ResearchRecord): string {
  const tags = Array.from(new Set(["olympus/research", `research/${record.sourceType}`, ...record.tags]));
  const safeTitle = record.title.trim() || "Untitled Research Record";

  return `---
title: ${yamlText(safeTitle)}
type: research
source_type: ${yamlText(record.sourceType)}
created: ${yamlText(record.createdAt)}
source_date: ${yamlText(record.sourceDate)}
category: ${yamlText(record.category)}
freshness: ${yamlText(record.freshness)}
origin: ${yamlText("Olympus Pantheon")}
tags:
${tags.map((tag) => `  - ${tag}`).join("\n")}
aliases:
  - ${yamlText(safeTitle)}
summary: ${yamlBlockText(record.summary)}
category_reason: ${yamlBlockText(record.categoryReason)}
---

# ${safeTitle}

> [!summary]
> ${record.summary}

> [!info]
> Source date: ${record.sourceDate}
>
> Category: ${categoryLabel(record.category)}

## Related

- [[Project Olympus]]
- [[Skill Index]]

## Pantheon Analysis

- Category: ${categoryLabel(record.category)}
- Why here: ${record.categoryReason}
- Freshness: ${record.freshness}
- Themes: ${record.themes.join(", ") || "none captured"}

## Source Content

${record.content}
`;
}

function createResearchBase(): string {
  return `filters:
  and:
    - 'file.inFolder("02 - Research")'
    - 'file.hasTag("olympus/research")'

formulas:
  est_words: '(file.size / 6).round(0)'
  read_time: 'if(file.size, ((file.size / 6) / 220).ceil().toString() + " min", "")'
  age_days: 'if(source_date, (today() - date(source_date)).days, "")'

properties:
  file.name:
    displayName: "Title"
  source_type:
    displayName: "Source"
  category:
    displayName: "Category"
  freshness:
    displayName: "Freshness"
  created:
    displayName: "Created"
  source_date:
    displayName: "Source Date"
  category_reason:
    displayName: "Why Categorized Here"
  summary:
    displayName: "Summary"
  tags:
    displayName: "Tags"
  formula.est_words:
    displayName: "Words"
  formula.read_time:
    displayName: "Read"
  formula.age_days:
    displayName: "Age (days)"

views:
  - type: table
    name: "Pantheon Library"
    order:
      - file.name
      - source_type
      - category
      - freshness
      - source_date
      - created
      - formula.read_time
      - formula.est_words
      - formula.age_days
      - tags
      - category_reason
      - summary
    groupBy:
      property: category
      direction: ASC

  - type: cards
    name: "Pantheon Cards"
    order:
      - file.name
      - category
      - freshness
      - summary
      - category_reason
      - tags
      - formula.read_time
`;
}

function hashHex(value: string): string {
  let hash = 0n;
  for (const character of value) {
    hash = (hash * 131n + BigInt(character.charCodeAt(0))) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0").slice(0, 16);
}

function createProjectsCanvas(projects: TrackedProject[]): string {
  const centerId = hashHex("olympus-projects-hub");
  const groupId = hashHex("olympus-projects-group");

  const nodes: Array<Record<string, unknown>> = [
    {
      id: groupId,
      type: "group",
      x: -120,
      y: -120,
      width: 1260,
      height: Math.max(620, projects.length * 190),
      label: "Olympus Projects",
      color: "5"
    },
    {
      id: centerId,
      type: "text",
      x: 320,
      y: 40,
      width: 320,
      height: 160,
      color: "6",
      text: "# Olympus Projects\n\nLive project map exported from Olympus.\n\nUse this canvas as the bridge between Git activity and Obsidian context."
    }
  ];

  const edges: Array<Record<string, unknown>> = [];

  projects.forEach((project, index) => {
    const id = hashHex(project.id);
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? 40 : 680;
    const y = 260 + row * 190;
    const branch = project.branch || "N/A";
    const repoState = project.repoState;
    const noteText = [
      `# ${project.name}`,
      "",
      `- Status: ${project.status}`,
      `- Branch: ${branch}`,
      `- Repo: ${repoState}`,
      "",
      `Next: ${project.nextStep}`
    ].join("\n");

    nodes.push({
      id,
      type: "text",
      x,
      y,
      width: 440,
      height: 140,
      color: project.status === "active" ? "4" : "3",
      text: noteText
    });

    edges.push({
      id: hashHex(`${project.id}-edge`),
      fromNode: centerId,
      fromSide: "bottom",
      toNode: id,
      toSide: "top",
      toEnd: "arrow",
      label: project.status
    });
  });

  return JSON.stringify({ nodes, edges }, null, 2);
}

async function writeArtifact(
  vaultPath: string,
  folder: string,
  fileName: string,
  content: string
): Promise<WriteMemoryArtifactResult> {
  return invoke<WriteMemoryArtifactResult>("write_memory_artifact", {
    artifact: {
      vault_path: vaultPath,
      folder,
      file_name: fileName,
      content
    }
  });
}

export async function syncResearchNoteToVault(
  vaultPath: string,
  record: ResearchRecord
): Promise<ObsidianActionResult> {
  if (!isTauriRuntime()) {
    return {
      tone: "warning",
      message: "Research saved locally. Obsidian sync is available in the desktop app."
    };
  }

  const safeTitle = sanitizeFileName(record.title) || "Untitled Research Record";
  const fileName = `${record.createdAt} ${safeTitle}.md`;
  const result = await writeArtifact(vaultPath, "02 - Research", fileName, createResearchMarkdown(record));

  return {
    tone: "success",
    message: `Saved Obsidian note to 02 - Research/${fileName}`,
    path: result.path
  };
}

export async function syncResearchBaseToVault(vaultPath: string): Promise<ObsidianActionResult> {
  if (!isTauriRuntime()) {
    return {
      tone: "warning",
      message: "The Research Base can be generated from the desktop app."
    };
  }

  const fileName = "Olympus Research.base";
  const result = await writeArtifact(vaultPath, "00 - Dashboard", fileName, createResearchBase());
  return {
    tone: "success",
    message: `Updated Obsidian Base at 00 - Dashboard/${fileName}`,
    path: result.path
  };
}

export async function syncProjectsCanvasToVault(
  vaultPath: string,
  projects: TrackedProject[]
): Promise<ObsidianActionResult> {
  if (!isTauriRuntime()) {
    return {
      tone: "warning",
      message: "The project canvas can be generated from the desktop app."
    };
  }

  const fileName = "Olympus Projects.canvas";
  const result = await writeArtifact(vaultPath, "00 - Dashboard", fileName, createProjectsCanvas(projects));
  return {
    tone: "success",
    message: `Updated JSON Canvas at 00 - Dashboard/${fileName}`,
    path: result.path
  };
}

export function projectNoteLink(projectName: string): string {
  return `[[${projectNoteName(projectName)}]]`;
}
