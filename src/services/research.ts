import { analyzeResearchRecord } from "./pantheonAnalysis";
import type { ResearchRecord } from "../types";

export function createResearchRecordFromText(
  title: string,
  sourceText: string,
  sourceType: ResearchRecord["sourceType"],
  sourceDate: string
): ResearchRecord {
  const normalizedSourceDate = sourceDate || new Date().toISOString().slice(0, 10);
  const normalizedText = sourceText.trim();
  const createdAt = new Date().toISOString().slice(0, 10);
  const analysis = analyzeResearchRecord({
    title,
    content: normalizedText,
    sourceType,
    sourceDate: normalizedSourceDate,
    createdAt
  });

  return {
    id: `research-${Date.now()}`,
    title: title.trim() || "Untitled Research Record",
    sourceType,
    createdAt,
    sourceDate: normalizedSourceDate,
    tags: analysis.tags,
    summary: analysis.summary,
    content: normalizedText,
    category: analysis.category,
    categoryReason: analysis.categoryReason,
    themes: analysis.themes,
    wordCount: analysis.wordCount,
    estReadMinutes: analysis.estReadMinutes,
    freshness: analysis.freshness
  };
}
