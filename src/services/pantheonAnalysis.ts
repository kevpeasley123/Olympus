import type { PantheonCategory, PantheonFreshness, ResearchRecord } from "../types";

interface CategoryRule {
  id: PantheonCategory;
  label: string;
  description: string;
  titleTerms: string[];
  bodyTerms: string[];
  phrases: string[];
  sourceTypeBoosts: Partial<Record<ResearchRecord["sourceType"], number>>;
}

interface AnalysisInput {
  title: string;
  content: string;
  sourceType: ResearchRecord["sourceType"];
  sourceDate: string;
  createdAt: string;
  summary?: string;
  tags?: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    id: "agent-systems",
    label: "Agent Systems",
    description: "Agentic orchestration, operator patterns, multi-agent structure, and AI collaboration.",
    titleTerms: ["agent", "orchestration", "workflow", "operator", "llm", "agents"],
    bodyTerms: ["agent", "multi-agent", "tool use", "planner", "supervisor", "memory", "orchestration", "prompting", "reasoning"],
    phrases: ["agentic ai", "multi agent", "project manager ai", "tool calling", "ai workflow"],
    sourceTypeBoosts: { article: 1, note: 1, transcript: 2 }
  },
  {
    id: "project-origination",
    label: "Project Origination",
    description: "Project scaffolds, architecture patterns, stack choices, and build planning.",
    titleTerms: ["project", "scaffold", "architecture", "build", "system", "roadmap"],
    bodyTerms: ["architecture", "stack", "repo", "scaffold", "mvp", "prototype", "planning", "requirements", "spec"],
    phrases: ["project setup", "system design", "technical architecture", "build plan"],
    sourceTypeBoosts: { article: 1, note: 2, manual: 1 }
  },
  {
    id: "research-references",
    label: "Research & References",
    description: "Papers, articles, essays, benchmarks, and reference material worth keeping around.",
    titleTerms: ["research", "reference", "paper", "study", "essay", "benchmark"],
    bodyTerms: ["research", "paper", "study", "evidence", "benchmark", "reference", "analysis", "finding"],
    phrases: ["research paper", "case study", "benchmark result", "reference material"],
    sourceTypeBoosts: { article: 3, note: 1 }
  },
  {
    id: "media-capture",
    label: "Media & Capture",
    description: "Transcripts, YouTube/video knowledge, media workflows, and captured source material.",
    titleTerms: ["video", "youtube", "transcript", "media", "podcast"],
    bodyTerms: ["video", "youtube", "thumbnail", "transcript", "audio", "recording", "content", "capture"],
    phrases: ["youtube transcript", "video workflow", "media workflow", "content production"],
    sourceTypeBoosts: { transcript: 4, article: 1 }
  },
  {
    id: "procedures-playbooks",
    label: "Procedures & Playbooks",
    description: "Runbooks, checklists, SOPs, workflows, and repeatable operating procedures.",
    titleTerms: ["procedure", "playbook", "runbook", "checklist", "guide", "workflow"],
    bodyTerms: ["step", "checklist", "procedure", "workflow", "runbook", "playbook", "standard operating", "sop"],
    phrases: ["step by step", "standard operating procedure", "how to", "operating procedure"],
    sourceTypeBoosts: { manual: 4, note: 1 }
  }
];

const CATEGORY_ORDER: PantheonCategory[] = [
  "agent-systems",
  "project-origination",
  "research-references",
  "media-capture",
  "procedures-playbooks",
  "general-reference"
];

export function categoryLabel(category: PantheonCategory): string {
  return CATEGORY_RULES.find((rule) => rule.id === category)?.label ?? "General Reference";
}

export function categoryDescription(category: PantheonCategory): string {
  return (
    CATEGORY_RULES.find((rule) => rule.id === category)?.description ??
    "Material worth keeping nearby even when it doesn't fit a sharper operating bucket yet."
  );
}

export function orderedCategories(): PantheonCategory[] {
  return CATEGORY_ORDER;
}

export function analyzeResearchRecord(input: AnalysisInput): Pick<
  ResearchRecord,
  "summary" | "tags" | "category" | "categoryReason" | "themes" | "wordCount" | "estReadMinutes" | "freshness"
> {
  const normalizedTitle = input.title.trim() || "Untitled Research Record";
  const normalizedContent = input.content.trim();
  const summary = buildSummary(input.summary, normalizedContent);
  const wordCount = countWords(normalizedContent);
  const estReadMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const freshness = computeFreshness(input.sourceDate);
  const scoring = scoreCategories(normalizedTitle, normalizedContent, input.sourceType);
  const best = scoring[0];

  const category = best && best.score > 0 ? best.rule.id : "general-reference";
  const signalTerms = best?.signals.slice(0, 3) ?? [];
  const categoryReason =
    signalTerms.length > 0
      ? `Categorized as ${categoryLabel(category)} because it emphasizes ${signalTerms.join(", ")}.`
      : `Categorized as ${categoryLabel(category)} because it does not strongly match a narrower operating bucket yet.`;

  const tags = Array.from(
    new Set([
      "olympus/pantheon",
      "olympus/research",
      `research/${input.sourceType}`,
      `pantheon/${category}`,
      ...(input.tags ?? []),
      ...signalTerms.map((term) => slugTag(term))
    ])
  );

  return {
    summary,
    tags,
    category,
    categoryReason,
    themes: signalTerms,
    wordCount,
    estReadMinutes,
    freshness
  };
}

export function normalizeResearchRecord(record: ResearchRecord): ResearchRecord {
  const analysis = analyzeResearchRecord({
    title: record.title,
    content: record.content,
    sourceType: record.sourceType,
    sourceDate: record.sourceDate ?? record.createdAt,
    createdAt: record.createdAt,
    summary: record.summary,
    tags: record.tags
  });

  return {
    ...record,
    sourceDate: record.sourceDate ?? record.createdAt,
    summary: record.summary || analysis.summary,
    tags: record.tags?.length ? Array.from(new Set([...record.tags, ...analysis.tags])) : analysis.tags,
    category: record.category ?? analysis.category,
    categoryReason: record.categoryReason ?? analysis.categoryReason,
    themes: record.themes?.length ? record.themes : analysis.themes,
    wordCount: record.wordCount ?? analysis.wordCount,
    estReadMinutes: record.estReadMinutes ?? analysis.estReadMinutes,
    freshness: record.freshness ?? analysis.freshness
  };
}

function buildSummary(existingSummary: string | undefined, content: string): string {
  if (existingSummary?.trim()) {
    return existingSummary.trim();
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "No summary available yet.";

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(" ") || normalized.slice(0, 220);
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

function computeFreshness(sourceDate: string): PantheonFreshness {
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return "undated";

  const ageDays = Math.floor((Date.now() - parsed) / 86_400_000);
  if (ageDays > 730) return "stale";
  if (ageDays > 365) return "dated";
  if (ageDays > 180) return "watch";
  return "recent";
}

function scoreCategories(title: string, content: string, sourceType: ResearchRecord["sourceType"]) {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  return CATEGORY_RULES.map((rule) => {
    let score = rule.sourceTypeBoosts[sourceType] ?? 0;
    const signals = new Set<string>();

    rule.titleTerms.forEach((term) => {
      if (lowerTitle.includes(term)) {
        score += 5;
        signals.add(term);
      }
    });

    rule.phrases.forEach((phrase) => {
      if (lowerTitle.includes(phrase) || lowerContent.includes(phrase)) {
        score += 6;
        signals.add(phrase);
      }
    });

    rule.bodyTerms.forEach((term) => {
      if (lowerContent.includes(term)) {
        score += 2;
        signals.add(term);
      }
    });

    return {
      rule,
      score,
      signals: Array.from(signals)
    };
  }).sort((left, right) => right.score - left.score);
}

function slugTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
