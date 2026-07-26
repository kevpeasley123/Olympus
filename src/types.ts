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
  category: "Music" | "Chat" | "Browser" | "Video";
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

export interface WeatherForecastDay {
  dayLabel: string;
  weatherCode: number;
  high: string;
  low: string;
  isToday: boolean;
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
  /** Carried straight from the note's frontmatter — see `hooks/usePantheon`. */
  stance?: string;
  whyKept?: string;
  origin?: string;
}

export interface ConversationMessage {
  id: string;
  role: "system" | "assistant" | "user";
  content: string;
  timestamp: string;
}

/**
 * `unclassified` is the absence of a declaration, not a decision. It is never
 * written into a note — `scaffold` is what the operator picks when they mean
 * "this is a stub". Keeping them distinct is what stops an unclassified project
 * from being collapsed out of sight as though someone had judged it.
 */
export type ProjectStatus = "active" | "watching" | "scaffold" | "archived" | "unclassified";

/** Whether a vault note said so, or nothing did. */
export type ProjectStatusSource = "declared" | "inferred";

export interface TrackedProject {
  id: string;
  name: string;
  /** Empty when the note has no matching folder under the projects root. */
  path: string;
  status: ProjectStatus;
  statusSource: ProjectStatusSource;
  promoted: string | null;
  branch: string;
  lastCommit: string;
  /** ISO 8601, or null for a folder with no commits. */
  lastCommitAt: string | null;
  repoState: "git-active" | "git-pending" | "folder-only" | "no-repo";
  summary: string;
  /** The operator's own words, or empty. Never generated. */
  nextStep: string;
  notePath: string | null;
  warnings: string[];
}

/// The vault root is owned by Rust (`commands::get_vault_path`) so the app has
/// a single source of truth for where the vault lives. It is deliberately not
/// a setting.
export interface OlympusSettings {
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
  conversation: ConversationMessage[];
  settings: OlympusSettings;
}
