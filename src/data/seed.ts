import type { OlympusState } from "../types";

const today = new Date().toISOString().slice(0, 10);

export const seedState: OlympusState = {
  version: 7,
  settings: {
    projectsRootPath: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects"
  },
  tools: [
    {
      id: "tool-image-to-video",
      name: "Image to Video",
      category: "Media",
      status: "planned",
      description: "Turn still images into short motion clips with controllable style and timing.",
      primaryAction: "Configure",
      enabled: true
    },
    {
      id: "tool-youtube-transcript",
      name: "YouTube to Transcript",
      category: "Research",
      status: "ready",
      description: "Capture a video transcript and convert it into usable text for notes or summaries.",
      primaryAction: "Launch",
      enabled: true
    },
    {
      id: "tool-article-summarizer",
      name: "Article Summarizer",
      category: "Research",
      status: "ready",
      description: "Condense long articles into brief-ready notes with the key points preserved.",
      primaryAction: "Launch",
      enabled: true
    },
    {
      id: "tool-project-scaffold",
      name: "Project Scaffold",
      category: "Workflow",
      status: "planned",
      description: "Start new projects from a preferred stack and a repeatable setup brief.",
      primaryAction: "Configure",
      enabled: true
    }
  ],
  quickApps: [
    {
      id: "quick-spotify",
      name: "Spotify",
      category: "Music",
      launchUri: "https://open.spotify.com"
    },
    {
      id: "quick-discord",
      name: "Discord",
      category: "Chat",
      launchUri: "https://discord.com/app"
    },
    {
      id: "quick-x",
      name: "X",
      category: "Browser",
      launchUri: "https://x.com"
    },
    {
      id: "quick-youtube",
      name: "YouTube",
      category: "Video",
      launchUri: "https://youtube.com"
    }
  ],
  // Preview data for the browser dev server, which has no Tauri commands and so
  // never runs the real scan. `status` here is declared rather than inferred
  // only because the seed is standing in for a vault that has notes; the desktop
  // app replaces all of this on first scan.
  projects: [
    {
      id: "project-olympus-dashboard",
      name: "Olympus",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Olympus",
      status: "active",
      statusSource: "declared",
      promoted: "2026-04-25",
      branch: "master",
      lastCommit: "b02ed86 Initial Olympus dashboard build",
      lastCommitAt: "2026-04-25T12:00:00+00:00",
      repoState: "git-pending",
      recentCommits: [],
      sinceSessionCommits: [],
      linkedWorktrees: [],
      summary: "Command center dashboard, Codex-native second-brain structure, and project coordination surface.",
      vision:
        "A private, local-first AI command station and thinking partner that maintains trustworthy project state, offers meaningful paths, challenges weak reasoning, and safely delegates recoverable work.",
      visionReviewedAt: "2026-07-27",
      nextStep:
        "Validate the restored Command instrument and Project-mode session paths in the real desktop app, then design the first recoverable coding-agent delegation loop.",
      notePath: "01 - Projects/Project Olympus.md",
      warnings: []
    },
    {
      id: "project-pokedex",
      name: "Pokedex",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Pokedex",
      status: "watching",
      statusSource: "declared",
      promoted: null,
      branch: "master",
      lastCommit: "05f1dae Fix 1st Edition price inflation across all price paths",
      lastCommitAt: "2026-04-20T12:00:00+00:00",
      repoState: "git-pending",
      recentCommits: [],
      sinceSessionCommits: [],
      linkedWorktrees: [],
      summary: "Active code project with recent Git history and local uncommitted changes.",
      vision: "Make collection tracking and card pricing accurate, useful, and easy to operate.",
      visionReviewedAt: null,
      nextStep: "",
      notePath: "01 - Projects/Pokedex.md",
      warnings: []
    },
    {
      id: "project-obsidian-visual",
      name: "Obsidian Visual Project",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Obsidian Visual Project",
      status: "unclassified",
      statusSource: "inferred",
      promoted: null,
      branch: "master",
      lastCommit: "No commits yet",
      lastCommitAt: null,
      repoState: "git-pending",
      recentCommits: [],
      sinceSessionCommits: [],
      linkedWorktrees: [],
      summary: "Project folder exists as a Git repo but has not been committed yet.",
      vision: "",
      visionReviewedAt: null,
      nextStep: "",
      notePath: null,
      warnings: []
    },
    {
      id: "project-agentic-ai-scaffolder",
      name: "Agentic AI Scaffolder",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Agentic AI Scaffolder",
      status: "scaffold",
      statusSource: "declared",
      promoted: null,
      branch: "N/A",
      lastCommit: "Folder only",
      lastCommitAt: null,
      repoState: "folder-only",
      recentCommits: [],
      sinceSessionCommits: [],
      linkedWorktrees: [],
      summary: "Desktop project folder present but not yet wired into Git tracking.",
      vision: "",
      visionReviewedAt: null,
      nextStep: "",
      notePath: "01 - Projects/Agentic AI Scaffolder.md",
      warnings: []
    }
  ],
  conversation: [
    {
      id: "conversation-1",
      role: "system",
      content:
        "Olympus is in command-center mode. Keep the home screen sparse, useful, and biased toward action.",
      timestamp: "09:14"
    },
    {
      id: "conversation-2",
      role: "assistant",
      content:
        "Tools should stay compact. Research should open as a library first. New ingestion should appear only when you ask for it.",
      timestamp: "09:16"
    }
  ]
};
