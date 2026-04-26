import { FilePlus2, Layers3, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { restartDesktopApp } from "../../services/launcher";
import {
  categoryDescription,
  categoryLabel,
  orderedCategories
} from "../../services/pantheonAnalysis";
import type { ObsidianActionResult } from "../../services/obsidian";
import type { ResearchRecord } from "../../types";

interface LibraryPanelProps {
  entries: ResearchRecord[];
  onAddResearch: (
    title: string,
    text: string,
    sourceType: ResearchRecord["sourceType"],
    sourceDate: string
  ) => Promise<ObsidianActionResult>;
  onViewDatabase: () => Promise<ObsidianActionResult>;
}

interface PantheonSection {
  title: string;
  description: string;
  category: ResearchRecord["category"];
  entries: ResearchRecord[];
}

export function LibraryPanel({ entries, onAddResearch, onViewDatabase }: LibraryPanelProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<ResearchRecord["sourceType"]>("article");
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "view" | "restart" | null>(null);
  const pantheonSections = useMemo(() => groupEntries(entries), [entries]);
  const entryLabel = useMemo(() => buildEntryLabel(entries), [entries]);

  async function handleSubmit() {
    setBusyAction("save");
    const result = await onAddResearch(title, text, sourceType, sourceDate);
    setStatus(result);
    setBusyAction(null);

    if (result.tone === "error" || !text.trim()) return;

    setTitle("");
    setText("");
    setSourceDate(new Date().toISOString().slice(0, 10));
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

  async function handleRestartApp() {
    setBusyAction("restart");
    const result = await restartDesktopApp();
    if (result === "unsupported") {
      setStatus({
        tone: "warning",
        message: "Desktop restart is only available in the native Olympus app."
      });
      setBusyAction(null);
    }
  }

  return (
    <section className="dashboard-panel research-panel pantheon-panel">
      <div className="panel-header pantheon-header">
        <div className="pantheon-title-block">
          <h2>Pantheon</h2>
          <p className="section-copy research-count">{entryLabel}</p>
        </div>
        <div className="panel-actions">
          <button
            className={`ghost-action ${databaseOpen ? "is-active" : ""}`}
            onClick={() => void handleViewDatabase()}
            disabled={busyAction === "save" || busyAction === "restart"}
          >
            <Layers3 size={15} />
            {busyAction === "view" ? "Refreshing..." : databaseOpen ? "Hide Database" : "View Database"}
          </button>
          <button
            className={composerOpen ? "ghost-action is-active" : "ghost-action"}
            onClick={() => setComposerOpen((value) => !value)}
            disabled={busyAction === "view" || busyAction === "restart"}
          >
            <FilePlus2 size={15} />
            {composerOpen ? "Close Entry" : "Add Entry"}
          </button>
          <button
            className="ghost-action icon-only-action"
            onClick={() => void handleRestartApp()}
            disabled={busyAction !== null}
            title="Restart Olympus desktop app"
            aria-label="Restart Olympus desktop app"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

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
                        <div className="pantheon-entry-heading">
                          <strong>{entry.title}</strong>
                          <span className={`pantheon-category-chip ${entry.category}`}>
                            {categoryLabel(entry.category)}
                          </span>
                        </div>
                        <span className="pantheon-entry-meta">
                          {entry.sourceType} {"\u00b7"} source {entry.sourceDate} {"\u00b7"} {entry.estReadMinutes} min{" "}
                          {"\u00b7"} {entry.wordCount} words
                        </span>
                      </div>
                      <p className="section-copy pantheon-entry-summary">{entry.summary}</p>
                      <div className="pantheon-entry-analysis">
                        <span className={`pantheon-freshness-chip ${entry.freshness}`}>
                          {freshnessLabel(entry.freshness)}
                        </span>
                        <p className="section-copy pantheon-entry-why">{entry.categoryReason}</p>
                      </div>
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
          <div className="composer-grid pantheon-meta-grid">
            <div className="composer-field">
              <span>Source date</span>
              <input
                type="date"
                value={sourceDate}
                onChange={(event) => setSourceDate(event.target.value)}
              />
            </div>
            <div className="composer-field">
              <span>Why this matters</span>
              <small>
                Pantheon keeps the original source date so you and future AI agents can reason
                about staleness.
              </small>
            </div>
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

function buildEntryLabel(entries: ResearchRecord[]): string {
  const countLabel = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  if (entries.length === 0) {
    return countLabel;
  }

  const latest = [...entries]
    .map((entry) => entry.createdAt ?? entry.sourceDate)
    .filter(Boolean)
    .sort();

  const latestValue = latest.length > 0 ? latest[latest.length - 1] : undefined;

  if (!latestValue) {
    return countLabel;
  }

  const parsed = new Date(latestValue);
  const updatedLabel = Number.isNaN(parsed.valueOf())
    ? latestValue
    : parsed.toLocaleDateString([], { month: "short", day: "numeric" });

  return `${countLabel} \u00b7 Updated ${updatedLabel}`;
}

function groupEntries(entries: ResearchRecord[]): PantheonSection[] {
  const buckets = new Map<ResearchRecord["category"], PantheonSection>();

  orderedCategories().forEach((category) => {
    buckets.set(category, {
      title: categoryLabel(category),
      description: categoryDescription(category),
      category,
      entries: []
    });
  });

  entries.forEach((entry) => {
    buckets.get(entry.category)?.entries.push(entry);
  });

  return Array.from(buckets.values())
    .map((section) => ({
      ...section,
      entries: [...section.entries].sort((left, right) => right.sourceDate.localeCompare(left.sourceDate))
    }))
    .filter((section) => section.entries.length > 0);
}

function freshnessLabel(freshness: ResearchRecord["freshness"]): string {
  switch (freshness) {
    case "recent":
      return "Recent";
    case "watch":
      return "Watch Age";
    case "dated":
      return "Dated";
    case "stale":
      return "Stale";
    default:
      return "Undated";
  }
}
