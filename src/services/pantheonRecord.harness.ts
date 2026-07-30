import type { PantheonEntry } from "../hooks/usePantheon";
import { pantheonEntryToResearchRecord } from "./pantheonRecord";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function entry(overrides: Partial<PantheonEntry> = {}): PantheonEntry {
  return {
    id: "02 - Research/graph-engineering.md",
    title: "Graph Engineering: build 1000+ agent loops in one window",
    sourceFile: "02 - Research/graph-engineering.md",
    entryType: "research",
    sourceType: "article",
    created: "2026-07-29",
    origin: "collected",
    stance: "unevaluated",
    tags: ["olympus/research", "research/article"],
    wordCount: 1_850,
    fileModifiedAt: "2026-07-29T17:00:00-07:00",
    bodyPreview: "",
    body:
      "Design a graph of agents. Fan out independent work, use multi-agent orchestration, verify on fresh context, and isolate workers in separate worktrees.",
    ...overrides
  };
}

export function runPantheonRecordHarness() {
  const inferred = pantheonEntryToResearchRecord(entry());
  assert(
    inferred.category === "agent-systems",
    `graph-shaped agent article landed in ${inferred.category}`
  );
  assert(
    inferred.categoryReason.includes("agent"),
    "inferred Agent Systems entry lost its category evidence"
  );

  const explicitlyTagged = pantheonEntryToResearchRecord(
    entry({
      title: "A neutral title",
      body: "A deliberately short captured source.",
      tags: ["olympus/research", "research/article", "agent-systems"]
    })
  );
  assert(
    explicitlyTagged.category === "agent-systems",
    "explicit agent-systems tag did not control the category"
  );
  assert(
    explicitlyTagged.categoryReason.includes("explicitly carries"),
    "explicit category tag was not distinguished from inferred classification"
  );
  assert(
    explicitlyTagged.tags.includes("pantheon/agent-systems"),
    "normalized record lost its generated Pantheon category tag"
  );

  const otherArticle = pantheonEntryToResearchRecord(
    entry({
      title: "Benchmark reference",
      body: "A research paper reporting evidence, analysis, and benchmark findings.",
      tags: ["olympus/research", "research/article"]
    })
  );
  assert(
    otherArticle.category === "research-references",
    "repair collapsed unrelated articles into Agent Systems"
  );

  return {
    passed: true,
    inferredCategory: inferred.category,
    explicitCategory: explicitlyTagged.category,
    unrelatedCategory: otherArticle.category
  };
}
