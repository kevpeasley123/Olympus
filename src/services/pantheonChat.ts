import type { ConversationMessage, ResearchRecord } from "../types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "build",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "show",
  "talks",
  "that",
  "the",
  "this",
  "to",
  "using",
  "visual",
  "what"
]);

export function createUserMessage(content: string): ConversationMessage {
  return {
    id: `conversation-user-${Date.now()}`,
    role: "user",
    content,
    timestamp: timeLabel()
  };
}

export function buildPantheonReply(query: string, entries: ResearchRecord[]): ConversationMessage {
  const matched = matchEntries(query, entries).slice(0, 3);

  return {
    id: `conversation-assistant-${Date.now() + 1}`,
    role: "assistant",
    content: composeReply(query, matched, entries.length),
    timestamp: timeLabel()
  };
}

function composeReply(query: string, matches: ResearchRecord[], totalEntries: number): string {
  const lower = query.toLowerCase();

  if (matches.length === 0) {
    return `Pantheon has ${totalEntries} ${totalEntries === 1 ? "entry" : "entries"}, but I didn't find a close match for that request yet. Try naming a topic, article title, or concept you want me to search against the knowledge base.`;
  }

  const best = matches[0];
  const staleNote = stalenessNote(best.sourceDate);

  if (lower.includes("visual") || lower.includes("diagram") || lower.includes("picture")) {
    return `Best Pantheon match: "${best.title}" (${best.sourceDate}). ${staleNote} It seems to focus on ${best.summary} If you want a visual representation, the clearest structure would be: 1) the core system or claim, 2) the major moving parts, and 3) the workflow or consequences it implies. I also found ${matches
      .slice(1)
      .map((entry) => `"${entry.title}"`)
      .join(", ") || "no strong secondary companions"} as nearby context.`;
  }

  if (lower.includes("stale") || lower.includes("outdated") || lower.includes("recent")) {
    return matches
      .map(
        (entry, index) =>
          `${index + 1}. "${entry.title}" — source date ${entry.sourceDate}. ${stalenessNote(entry.sourceDate)} ${entry.summary}`
      )
      .join("\n");
  }

  return `Pantheon found ${matches.length} useful ${matches.length === 1 ? "entry" : "entries"} for that query. Start with "${best.title}" (${best.sourceDate}) — ${staleNote} ${best.summary} ${matches.length > 1 ? `Nearby context: ${matches
    .slice(1)
    .map((entry) => `"${entry.title}"`)
    .join(", ")}.` : ""}`;
}

function matchEntries(query: string, entries: ResearchRecord[]): ResearchRecord[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return entries
    .map((entry) => ({
      entry,
      score: scoreEntry(tokens, entry)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.entry.sourceDate.localeCompare(left.entry.sourceDate))
    .map((item) => item.entry);
}

function scoreEntry(tokens: string[], entry: ResearchRecord): number {
  const title = entry.title.toLowerCase();
  const summary = entry.summary.toLowerCase();
  const content = entry.content.toLowerCase();
  const tags = entry.tags.join(" ").toLowerCase();

  return tokens.reduce((score, token) => {
    let next = score;
    if (title.includes(token)) next += 5;
    if (tags.includes(token)) next += 4;
    if (summary.includes(token)) next += 3;
    if (content.includes(token)) next += 1;
    return next;
  }, 0);
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function stalenessNote(sourceDate: string): string {
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return "Its source date is unclear, so staleness is hard to judge.";

  const ageDays = Math.floor((Date.now() - parsed) / 86_400_000);
  if (ageDays > 730) return "This source is more than two years old, so we should sanity-check it against newer thinking.";
  if (ageDays > 365) return "This source is over a year old, so there is some real chance parts of it are dated.";
  if (ageDays > 180) return "This source is moderately aged, but still recent enough to be useful with context.";
  return "This source is still fairly recent.";
}

function timeLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
