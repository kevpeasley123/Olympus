export type ToolStatus = "ready" | "planned" | "draft";
export type ToolCategory = "Media" | "Research" | "Workflow";

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  status: ToolStatus;
  description: string;
  primaryAction: string;
  enabled: boolean;
}

export interface QuickApp {
  id: string;
  name: string;
  category: "Music" | "Chat" | "Browser";
  launchUri: string;
}

export interface MarketIndex {
  id: string;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
}

export interface MarketRate {
  id: string;
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
}

export interface MarketSector {
  id: string;
  label: string;
  tone: "risk-on" | "neutral" | "risk-off";
}

export interface MarketNewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
}

export interface MarketSnapshot {
  date: string;
  indexes: MarketIndex[];
  rates: MarketRate[];
  sectors: MarketSector[];
  news: MarketNewsItem[];
  summary: string;
  watchNote: string;
}

export interface WeatherSnapshot {
  label: string;
  temperature: string;
  condition: string;
  humidity: string;
  wind: string;
  feelsLike: string;
  source: "sample";
}

export interface NowPlayingSnapshot {
  source: string;
  status: "playing" | "paused" | "idle";
  track: string;
  artist: string;
  detail: string;
}

export type PantheonCategory =
  | "agent-systems"
  | "project-origination"
  | "research-references"
  | "media-capture"
  | "procedures-playbooks"
  | "general-reference";

export type PantheonFreshness = "recent" | "watch" | "dated" | "stale" | "undated";

export interface ResearchRecord {
  id: string;
  title: string;
  sourceType: "article" | "transcript" | "note" | "manual";
  createdAt: string;
  sourceDate: string;
  tags: string[];
  summary: string;
  content: string;
  category: PantheonCategory;
  categoryReason: string;
  themes: string[];
  wordCount: number;
  estReadMinutes: number;
  freshness: PantheonFreshness;
}

export interface ConversationMessage {
  id: string;
  role: "system" | "assistant" | "user";
  content: string;
  timestamp: string;
}

export interface TrackedProject {
  id: string;
  name: string;
  path: string;
  status: "active" | "watching" | "setup";
  branch: string;
  lastCommit: string;
  repoState: "git-active" | "git-pending" | "folder-only";
  summary: string;
  nextStep: string;
}

export interface OlympusSettings {
  vaultPath: string;
  projectsRootPath: string;
}

export interface OlympusState {
  version: number;
  tools: ToolDefinition[];
  quickApps: QuickApp[];
  market: MarketSnapshot;
  weather: WeatherSnapshot;
  nowPlaying: NowPlayingSnapshot;
  projects: TrackedProject[];
  research: ResearchRecord[];
  conversation: ConversationMessage[];
  settings: OlympusSettings;
}
