import type { ResearchRecord } from "../types";

export function createResearchRecordFromText(
  title: string,
  sourceText: string,
  sourceType: ResearchRecord["sourceType"]
): ResearchRecord {
  const normalized = sourceText.trim().replace(/\s+/g, " ");
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);

  return {
    id: `research-${Date.now()}`,
    title: title.trim() || "Untitled Research Record",
    sourceType,
    createdAt: new Date().toISOString().slice(0, 10),
    tags: inferTags(normalized),
    summary: sentences.slice(0, 2).join(" ") || normalized.slice(0, 280),
    content: sourceText.trim()
  };
}

function inferTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];

  if (lower.includes("market") || lower.includes("rates") || lower.includes("bond")) {
    tags.push("markets");
  }
  if (lower.includes("video") || lower.includes("youtube")) {
    tags.push("video");
  }
  if (lower.includes("image") || lower.includes("visual")) {
    tags.push("media");
  }
  if (tags.length === 0) {
    tags.push("inbox");
  }

  return tags;
}
