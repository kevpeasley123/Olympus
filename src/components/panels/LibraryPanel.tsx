import { FilePlus2, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ObsidianActionResult } from "../../services/obsidian";
import type { ResearchRecord } from "../../types";

interface LibraryPanelProps {
  entries: ResearchRecord[];
  onAddResearch: (
    title: string,
    text: string,
    sourceType: ResearchRecord["sourceType"]
  ) => Promise<ObsidianActionResult>;
  onViewDatabase: () => Promise<ObsidianActionResult>;
}

interface PantheonSection {
  title: string;
  description: string;
  entries: ResearchRecord[];
}

const sectionDefinitions: Array<{
  title: string;
  description: string;
  matcher: (entry: ResearchRecord, haystack: string) => boolean;
}> = [
  {
    title: "Agent Systems",
    description: "Agentic orchestration, AI operator patterns, and project-manager intelligence.",
    matcher: (entry, haystack) =>
      haystack.includes("agent") ||
      haystack.includes("orchestrat") ||
      haystack.includes("project manager") ||
      haystack.includes("multi-agent")
  },
  {
    title: "Project Origination",
    description: "Architecture thinking, scaffold patterns, and project-starting ideas worth reusing.",
    matcher: (entry, haystack) =>
      haystack.includes("project") ||
      haystack.includes("scaffold") ||
      haystack.includes("architecture") ||
      haystack.includes("build")
  },
  {
    title: "Research & References",
    description: "Articles, notes, and supporting material that should stay queryable over time.",
    matcher: (entry, haystack) =>
      entry.sourceType === "article" ||
      haystack.includes("research") ||
      haystack.includes("reference") ||
      haystack.includes("study")
  },
  {
    title: "Media & Capture",
    description: "Transcripts, video workflows, and media-oriented source material.",
    matcher: (entry, haystack) =>
      entry.sourceType === "transcript" ||
      haystack.includes("video") ||
      haystack.includes("youtube") ||
      haystack.includes("media")
  },
  {
    title: "Procedures & Playbooks",
    description: "Instructions, workflows, and reusable operating procedures.",
    matcher: (entry, haystack) =>
      entry.sourceType === "manual" ||
      haystack.includes("procedure") ||
      haystack.includes("workflow") ||
      haystack.includes("playbook")
  }
];

export function LibraryPanel({ entries, onAddResearch, onViewDatabase }: LibraryPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState<ResearchRecord["sourceType"]>("article");
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "view" | null>(null);
  const entryLabel = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const pantheonSections = useMemo(() => groupEntries(entries), [entries]);

  async function handleSubmit() {
    setBusyAction("save");
    const result = await onAddResearch(title, text, sourceType);
    setStatus(result);
    setBusyAction(null);

    if (result.tone === "error" || !text.trim()) return;

    setTitle("");
    setText("");
    setSourceType("article");
    setComposerOpen(false);
    setDatabaseOpen(true);
  }

  async function handleViewDatabase() {
    if (databaseOpen) {
      setDatabaseOpen(false);
      return;
    }

    setBusyAction("view");
    const result = await onViewDatabase();
    setStatus(result);
    setBusyAction(null);
    setDatabaseOpen(true);
  }

  return (
    <section className="dashboard-panel research-panel pantheon-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Pantheon</p>
          <h2>Knowledge Base</h2>
          <p className="section-copy research-count">{entryLabel}</p>
        </div>
        <div className="panel-actions">
          <button
            className={`ghost-action ${databaseOpen ? "is-active" : ""}`}
            onClick={() => void handleViewDatabase()}
            disabled={busyAction === "save"}
          >
            <Layers3 size={15} />
            {busyAction === "view" ? "Refreshing..." : databaseOpen ? "Hide Database" : "View Database"}
          </button>
          <button
            className={composerOpen ? "ghost-action is-active" : "ghost-action"}
            onClick={() => setComposerOpen((value) => !value)}
            disabled={busyAction === "view"}
          >
            <FilePlus2 size={15} />
            {composerOpen ? "Close Entry" : "Add Entry"}
          </button>
        </div>
      </div>
      <p className="section-copy">
        Pantheon is Olympus&apos;s curated memory surface for research, project origination, and
        operating knowledge that future AI work should consult instead of rediscovering from
        scratch.
      </p>

      {status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}

      {databaseOpen && (
        <div className="pantheon-database">
          {pantheonSections.length === 0 ? (
            <div className="pantheon-empty">
              <strong>Pantheon is still empty.</strong>
              <p className="section-copy">
                Add articles, transcripts, and procedures here so Olympus can build a reusable
                knowledge layer around the patterns you care about.
              </p>
            </div>
          ) : (
            pantheonSections.map((section) => (
              <section key={section.title} className="pantheon-section">
                <div className="pantheon-section-head">
                  <div>
                    <strong>{section.title}</strong>
                    <p className="section-copy">{section.description}</p>
                  </div>
                  <span className="pantheon-section-count">{section.entries.length}</span>
                </div>
                <div className="pantheon-entry-list">
                  {section.entries.map((entry) => (
                    <article key={entry.id} className="pantheon-entry">
                      <div className="pantheon-entry-top">
                        <strong>{entry.title}</strong>
                        <span className="pantheon-entry-meta">
                          {entry.sourceType} · {estimateLength(entry)} · {entry.createdAt}
                        </span>
                      </div>
                      <p className="section-copy pantheon-entry-summary">{entry.summary}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {composerOpen && (
        <div className="research-composer">
          <div className="composer-grid">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Entry title"
            />
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as ResearchRecord["sourceType"])}
            >
              <option value="article">Article</option>
              <option value="transcript">Transcript</option>
              <option value="note">Note</option>
              <option value="manual">Procedure</option>
            </select>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste article text, transcript text, procedures, or important research notes"
          />
          <button className="primary-action" onClick={handleSubmit}>
            {busyAction === "save" ? "Saving..." : "Save to Pantheon"}
          </button>
        </div>
      )}
    </section>
  );
}

function estimateLength(entry: ResearchRecord): string {
  const words = entry.content.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return "empty";
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min · ${words} words`;
}

function groupEntries(entries: ResearchRecord[]): PantheonSection[] {
  const buckets = new Map<string, PantheonSection>();

  sectionDefinitions.forEach((definition) => {
    buckets.set(definition.title, {
      title: definition.title,
      description: definition.description,
      entries: []
    });
  });

  const fallback: PantheonSection = {
    title: "General Reference",
    description: "Material worth keeping nearby even when it does not fit a sharper operating bucket yet.",
    entries: []
  };

  entries.forEach((entry) => {
    const haystack = `${entry.title} ${entry.summary} ${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
    const match = sectionDefinitions.find((definition) => definition.matcher(entry, haystack));
    if (match) {
      buckets.get(match.title)?.entries.push(entry);
    } else {
      fallback.entries.push(entry);
    }
  });

  return [...Array.from(buckets.values()), fallback]
    .map((section) => ({
      ...section,
      entries: [...section.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }))
    .filter((section) => section.entries.length > 0);
}
