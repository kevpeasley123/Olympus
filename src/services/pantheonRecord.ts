import type { PantheonEntry } from "../hooks/usePantheon";
import type { ResearchRecord } from "../types";
import { analyzeResearchRecord } from "./pantheonAnalysis";

export function pantheonEntryToResearchRecord(entry: PantheonEntry): ResearchRecord {
  const sourceType = mapPantheonSourceType(entry.sourceType ?? entry.entryType);
  const createdAt = entry.created ?? entry.fileModifiedAt.slice(0, 10);
  const sourceDate = entry.sourceDate ?? createdAt;
  const content = entry.body || entry.bodyPreview;
  const analysis = analyzeResearchRecord({
    title: entry.title,
    content,
    sourceType,
    sourceDate,
    createdAt,
    tags: entry.tags
  });

  return {
    id: entry.id,
    title: entry.title,
    sourceType,
    createdAt,
    sourceDate,
    tags: analysis.tags,
    summary: analysis.summary,
    content,
    category: analysis.category,
    categoryReason: analysis.categoryReason,
    themes: analysis.themes,
    wordCount: entry.wordCount,
    estReadMinutes: Math.max(1, Math.ceil(entry.wordCount / 220)),
    freshness: analysis.freshness,
    stance: entry.stance,
    whyKept: entry.whyKept,
    origin: entry.origin
  };
}

function mapPantheonSourceType(input: string): ResearchRecord["sourceType"] {
  switch (input.toLowerCase()) {
    case "transcript":
      return "transcript";
    case "note":
      return "note";
    case "manual":
    case "procedure":
    case "playbook":
      return "manual";
    default:
      return "article";
  }
}
