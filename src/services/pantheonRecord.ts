import type { PantheonEntry } from "../hooks/usePantheon";
import type { ResearchRecord } from "../types";
import { analyzeResearchRecord } from "./pantheonAnalysis";

/**
 * Categorisation reads the whole body, so it runs once per entry version rather
 * than once per poll: a five-minute scan returns fresh objects for every entry,
 * and re-scoring a 3,000-entry library each time was the library's largest
 * repeated cost. Keyed by path, invalidated by the file's mtime and length.
 */
const RECORD_CACHE = new Map<string, { key: string; record: ResearchRecord }>();

export function pantheonEntryToResearchRecord(entry: PantheonEntry): ResearchRecord {
  const key = `${entry.fileModifiedAt}|${entry.body.length}|${entry.bodyPreview.length}|${entry.title}|${entry.stance}|${entry.tags.join(",")}|${entry.sourceType ?? entry.entryType}|${entry.created ?? ""}|${entry.sourceDate ?? ""}|${entry.whyKept ?? ""}|${entry.origin ?? ""}`;
  const cached = RECORD_CACHE.get(entry.id);
  if (cached && cached.key === key) return cached.record;
  const record = buildRecord(entry);
  RECORD_CACHE.set(entry.id, { key, record });
  return record;
}

function buildRecord(entry: PantheonEntry): ResearchRecord {
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

/**
 * The capture form offers Article, Transcript, Guide, Paper and Talk; each
 * keeps its own type here rather than collapsing into Article (review F3).
 */
export function mapPantheonSourceType(input: string): ResearchRecord["sourceType"] {
  switch (input.trim().toLowerCase()) {
    case "transcript":
      return "transcript";
    case "note":
      return "note";
    case "guide":
      return "guide";
    case "paper":
      return "paper";
    case "talk":
      return "talk";
    case "manual":
    case "procedure":
    case "playbook":
      return "manual";
    default:
      return "article";
  }
}
