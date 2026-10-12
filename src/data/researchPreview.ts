import type { PantheonEntry } from "../hooks/usePantheon";

/** Illustrative browser-development data; never persisted or used by the native vault. */
export const researchPreviewEntries: PantheonEntry[] = [
  {
    title: "Graph Engineering Explained",
    sourceType: "article",
    sourceLabel: "Graph Notes · sample blog",
    body: "# Graph Engineering Explained\n\nGraph-based systems connect ideas through nodes and relationships, making the path from a question to its supporting evidence easier to follow.\n\n## A simple starting point\n\nRepresent documents, concepts, and sources as separate nodes. Connect each claim to the passage that supports it, then inspect the connections before drawing conclusions.\n\nThis is an illustrative entry for the development preview, not a published article."
  },
  {
    title: "Agent Engineering — Coordinating a Small Team",
    sourceType: "transcript",
    sourceLabel: "Alex Morgan · sample speaker",
    body: "# Agent Engineering — Coordinating a Small Team\n\nA small team of specialized agents works best when each role has a clear task, a shared handoff format, and an independent check of the result.\n\n## Session excerpt\n\nStart with a planner, a researcher, and a reviewer. Keep the coordinator responsible for scope, and ask each agent to return evidence alongside its conclusions.\n\nThis is a fictional transcript for evaluating the development preview."
  },
  {
    title: "A Field Guide to Learning Systems",
    sourceType: "book",
    sourceLabel: "Jordan Ellis · sample author",
    body: "# A Field Guide to Learning Systems\n\nUseful knowledge grows through a cycle of reading, connecting ideas, trying them in practice, and revisiting what the evidence actually supports.\n\n## Reading notes\n\nKeep source material separate from your interpretation. Record a short takeaway, the question it helps answer, and an example worth testing.\n\nThis is a fictional book entry for evaluating the development preview."
  }
].map((entry,index) => ({
  ...entry,
  id: `research-preview-${index + 1}`,
  sourceFile: `02 - Research/Preview ${index + 1}.md`,
  entryType: "research",
  created: "2026-10-11",
  sourceDate: "2026-10-01",
  origin: "collected" as const,
  stance: "unevaluated" as const,
  tags: ["olympus/research"],
  wordCount: entry.body.split(/\s+/).length,
  fileModifiedAt: "2026-10-11T12:00:00-07:00",
  bodyPreview: entry.body
}));
