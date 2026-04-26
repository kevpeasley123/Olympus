import type { OlympusState } from "../types";
import { createResearchRecordFromText } from "../services/research";

const today = new Date().toISOString().slice(0, 10);

const marketStructureSeed = createResearchRecordFromText(
  "Starter Note: Market Structure Lens",
  "Use the research database to save ideas, articles, transcripts, and briefing notes that should remain available after the chat session ends.",
  "note",
  today
);

const mediaWorkflowSeed = createResearchRecordFromText(
  "Starter Note: Media Workflow Stack",
  "Store workflow experiments here so the tools section grows out of actual repeated needs instead of decorative ideas.",
  "note",
  today
);

export const seedState: OlympusState = {
  version: 7,
  settings: {
    vaultPath: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Obsidian vaults\\Olympus Obsidian Vault",
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
  market: {
    date: today,
    indexes: [
      { id: "spx", label: "S&P 500", value: "5,214.18", change: "+0.6%", direction: "up" },
      { id: "ndx", label: "Nasdaq 100", value: "18,112.44", change: "+0.9%", direction: "up" },
      { id: "dji", label: "Dow", value: "39,842.27", change: "-0.1%", direction: "down" }
    ],
    rates: [
      { id: "ust2", label: "2Y Treasury", value: "4.88%", change: "+4 bps", direction: "up" },
      { id: "ust10", label: "10Y Treasury", value: "4.41%", change: "+2 bps", direction: "up" },
      { id: "ust30", label: "30Y Treasury", value: "4.56%", change: "-1 bp", direction: "down" }
    ],
    sectors: [
      { id: "sector-tech", label: "Tech leadership", tone: "risk-on" },
      { id: "sector-financials", label: "Financials stable", tone: "neutral" },
      { id: "sector-utilities", label: "Defensives softer", tone: "risk-off" }
    ],
    news: [
      {
        id: "news-macro-1",
        headline: "Treasury yields stay firm as traders reprice the path of rate cuts",
        summary: "A live feed can eventually replace this stub with the top macro article driving equities and rates.",
        source: "Market feed placeholder"
      },
      {
        id: "news-tech-1",
        headline: "Large-cap tech continues to set the tone for index leadership",
        summary: "Olympus should surface the one or two stories that best explain why Nasdaq is outperforming on the day.",
        source: "Market feed placeholder"
      },
      {
        id: "news-risk-1",
        headline: "Risk appetite check: breadth, yields, and defensives are the tells to watch",
        summary: "Use this area for the most useful contextual article rather than a noisy stream of headlines.",
        source: "Market feed placeholder"
      }
    ],
    summary:
      "Risk appetite is modestly positive today, led by growth and a firmer Nasdaq while rates stay elevated.",
    watchNote:
      "Watch whether yields keep climbing into the close. If rates rise without equities fading, that is useful information about risk tolerance."
  },
  weather: {
    label: "Tucson, AZ",
    temperature: "74 F",
    condition: "Clear and dry",
    humidity: "29%",
    wind: "6 mph",
    feelsLike: "72 F",
    source: "sample"
  },
  nowPlaying: {
    source: "Spotify",
    status: "idle",
    track: "No active track",
    artist: "Desktop media session not connected yet",
    detail: "This widget is ready for live playback metadata once native media hooks are wired in."
  },
  projects: [
    {
      id: "project-olympus-dashboard",
      name: "Olympus",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Olympus",
      status: "active",
      branch: "master",
      lastCommit: "b02ed86 Initial Olympus dashboard build",
      repoState: "git-pending",
      summary: "Command center dashboard, Codex-native second-brain structure, and project coordination surface.",
      nextStep: "Add the quickbar and desktop media widget cleanly, then wire project cards to real Git status."
    },
    {
      id: "project-pokedex",
      name: "Pokedex",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Pokedex",
      status: "active",
      branch: "master",
      lastCommit: "05f1dae Fix 1st Edition price inflation across all price paths",
      repoState: "git-active",
      summary: "Active code project with recent Git history and local uncommitted changes.",
      nextStep: "Review the current working tree and decide whether the next step is cleanup, testing, or feature work."
    },
    {
      id: "project-obsidian-visual",
      name: "Obsidian Visual Project",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Obsidian Visual Project",
      status: "watching",
      branch: "master",
      lastCommit: "No commits yet",
      repoState: "git-pending",
      summary: "Project folder exists as a Git repo but has not been committed yet.",
      nextStep: "Clarify the project goal and create the first meaningful commit so Olympus can track momentum."
    },
    {
      id: "project-agentic-ai-scaffolder",
      name: "Agentic AI Scaffolder",
      path: "C:\\Users\\kevpe\\OneDrive\\Desktop\\Projects\\Agentic AI Scaffolder",
      status: "watching",
      branch: "N/A",
      lastCommit: "Folder only",
      repoState: "folder-only",
      summary: "Desktop project folder present but not yet wired into Git tracking.",
      nextStep: "Decide whether this becomes an active build and, if so, initialize the workspace conventions."
    }
  ],
  research: [
    {
      ...marketStructureSeed,
      id: "research-starter-market-structure"
    },
    {
      ...mediaWorkflowSeed,
      id: "research-starter-video-systems"
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
