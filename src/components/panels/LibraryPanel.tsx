import matter from "gray-matter";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  FilePlus2,
  Layers3,
  RotateCcw,
  RotateCw,
  Search
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { usePantheon, type PantheonEntry } from "../../hooks/usePantheon";
import { restartDesktopApp } from "../../services/launcher";
import {
  categoryDescription,
  categoryLabel,
  normalizeResearchRecord,
  orderedCategories
} from "../../services/pantheonAnalysis";
import type { ObsidianActionResult } from "../../services/obsidian";
import type { PantheonCategory, ResearchRecord } from "../../types";

interface LibraryPanelProps {
  onAddResearch: (
    title: string,
    text: string,
    sourceType: ResearchRecord["sourceType"],
    sourceDate: string
  ) => Promise<ObsidianActionResult>;
  onViewDatabase: () => Promise<ObsidianActionResult>;
}

interface PreparedPantheonEntry extends ResearchRecord {
  sourceLabel: string;
  markdownBody: string;
  sourceDateLabel: string;
  wordCountLabel: string;
}

interface PantheonSection {
  title: string;
  description: string;
  category: PantheonCategory;
  entries: PreparedPantheonEntry[];
}

type PantheonViewMode = "grouped" | "recent" | "all";
type AllEntriesSort = "date-desc" | "title-asc";

const SECTION_STORAGE_PREFIX = "pantheon.sectionExpanded.";
const SEARCH_DEBOUNCE_MS = 150;

export function LibraryPanel({ onAddResearch, onViewDatabase }: LibraryPanelProps) {
  const { entries: pantheonEntries, loading, error, refresh: refreshPantheon } = usePantheon();
  const [composerOpen, setComposerOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<ResearchRecord["sourceType"]>("article");
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "view" | "restart" | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<PantheonViewMode>("grouped");
  const [allEntriesSort, setAllEntriesSort] = useState<AllEntriesSort>("date-desc");
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PantheonCategory>(orderedCategories()[0]);
  const [expandedSections, setExpandedSections] = useState<Record<PantheonCategory, boolean>>(
    loadExpandedSections
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const suppressSpyUntilRef = useRef(0);
  const spyTimerRef = useRef<number | null>(null);
  const sectionRefs = useRef<Record<PantheonCategory, HTMLDivElement | null>>(
    buildCategoryRefRecord()
  );

  const preparedEntries = useMemo(
    () => pantheonEntries.map(pantheonEntryToResearchRecord).map(prepareEntry),
    [pantheonEntries]
  );
  const pantheonSections = useMemo(() => buildSections(preparedEntries), [preparedEntries]);
  const entryLabel = useMemo(() => {
    if (loading && pantheonEntries.length === 0) return "Loading entries...";
    return buildEntryLabel(preparedEntries);
  }, [loading, pantheonEntries.length, preparedEntries]);
  const selectedEntry = useMemo(
    () => preparedEntries.find((entry) => entry.id === detailEntryId) ?? null,
    [detailEntryId, preparedEntries]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    if (!databaseOpen) return;

    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (searchDraft) {
          setSearchDraft("");
          setSearchQuery("");
        } else {
          setDatabaseOpen(false);
          setDetailEntryId(null);
        }
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [databaseOpen, searchDraft]);

  useEffect(() => {
    if (!databaseOpen || detailEntryId || viewMode !== "grouped" || searchQuery) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }

    const root = mainScrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entriesObserved) => {
        const visible = entriesObserved
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visible.length === 0) return;
        if (Date.now() < suppressSpyUntilRef.current) return;

        const nextCategory = visible[0].target.getAttribute("data-category") as PantheonCategory | null;
        if (!nextCategory) return;

        if (spyTimerRef.current) {
          window.clearTimeout(spyTimerRef.current);
        }

        spyTimerRef.current = window.setTimeout(() => {
          setActiveCategory(nextCategory);
        }, 50);
      },
      {
        root,
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0.05
      }
    );

    pantheonSections.forEach((section) => {
      const node = sectionRefs.current[section.category];
      if (node) observer.observe(node);
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (spyTimerRef.current) {
        window.clearTimeout(spyTimerRef.current);
        spyTimerRef.current = null;
      }
    };
  }, [databaseOpen, detailEntryId, pantheonSections, searchQuery, viewMode]);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return pantheonSections;
    return pantheonSections.map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => matchesSearch(entry, searchQuery))
    }));
  }, [pantheonSections, searchQuery]);

  const searchHasMatches = filteredSections.some((section) => section.entries.length > 0);
  const recentEntries = useMemo(
    () => [...preparedEntries].sort(compareEntriesByDateDesc).slice(0, 10),
    [preparedEntries]
  );
  const allEntries = useMemo(() => {
    const next = [...preparedEntries];
    if (allEntriesSort === "title-asc") {
      return next.sort((left, right) => left.title.localeCompare(right.title));
    }
    return next.sort(compareEntriesByDateDesc);
  }, [allEntriesSort, preparedEntries]);

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
    setBusyAction("view");
    const result = await onViewDatabase();
    setStatus(result);
    setBusyAction(null);
    setDatabaseOpen(true);
  }

  function handleCloseDatabase() {
    setDatabaseOpen(false);
    setDetailEntryId(null);
  }

  function handleAddEntryFromModal() {
    handleCloseDatabase();
    if (!composerOpen) {
      console.warn(
        "[pantheon] Add Entry currently writes to localStorage; will be migrated to vault writes in Round Pantheon-B"
      );
      setComposerOpen(true);
    }
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

  function handleSectionToggle(category: PantheonCategory) {
    setExpandedSections((current) => {
      const next = { ...current, [category]: !current[category] };
      persistExpandedState(category, next[category]);
      return next;
    });
  }

  function handleCategoryJump(category: PantheonCategory) {
    setViewMode("grouped");
    setDetailEntryId(null);
    setActiveCategory(category);
    setExpandedSections((current) => {
      if (current[category]) return current;
      const next = { ...current, [category]: true };
      persistExpandedState(category, true);
      return next;
    });
    suppressSpyUntilRef.current = Date.now() + 500;
    sectionRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleViewModeChange(nextMode: PantheonViewMode) {
    setViewMode(nextMode);
    setDetailEntryId(null);
  }

  const detailBackLabel =
    viewMode === "recent"
      ? "Recent"
      : viewMode === "all"
        ? "All entries"
        : categoryLabel(selectedEntry?.category ?? activeCategory);

  return (
    <>
      <section className="dashboard-panel research-panel pantheon-panel">
        <div className="panel-header pantheon-header-bar">
          <div className="pantheon-title-block">
            <h2>Pantheon</h2>
            <p className="section-copy research-count">{entryLabel}</p>
          </div>

          <div className="pantheon-search-spacer" aria-hidden="true"></div>

          <div className="panel-actions">
            <button
              className="ghost-action"
              onClick={() => void handleViewDatabase()}
              disabled={busyAction === "save" || busyAction === "restart"}
            >
              <Layers3 size={15} />
              {busyAction === "view" ? "Refreshing..." : "View Database"}
            </button>
            <button
              className={composerOpen ? "ghost-action is-active" : "ghost-action"}
              onClick={() => {
                if (!composerOpen) {
                  console.warn(
                    "[pantheon] Add Entry currently writes to localStorage; will be migrated to vault writes in Round Pantheon-B"
                  );
                }
                setComposerOpen((value) => !value);
              }}
              disabled={busyAction === "view" || busyAction === "restart"}
            >
              <FilePlus2 size={15} />
              {composerOpen ? "Close Entry" : "Add Entry"}
            </button>
            <button
              className="ghost-action icon-only-action"
              onClick={() => void refreshPantheon()}
              disabled={loading}
              title="Refresh Pantheon entries from vault"
              aria-label="Refresh Pantheon entries from vault"
            >
              <RotateCw size={15} />
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

        {error && <p className="pantheon-error">Couldn't read vault entries: {error}</p>}

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

      {databaseOpen &&
        createPortal(
          <div className="pantheon-modal-backdrop" onClick={handleCloseDatabase}>
            <div
              className="pantheon-modal"
              role="dialog"
              aria-label="Pantheon Database"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="pantheon-modal-header">
                <div className="pantheon-modal-title-group">
                  <h2 className="pantheon-modal-title">Pantheon Database</h2>
                  <span className="pantheon-modal-meta">{entryLabel}</span>
                </div>
                <div className="pantheon-modal-actions">
                  <label className="pantheon-search-shell">
                    <Search size={14} className="pantheon-search-icon" />
                    <input
                      ref={searchInputRef}
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder="Search entries..."
                      className="pantheon-search-input"
                    />
                  </label>
                  <button
                    className="ghost-action icon-only-action"
                    onClick={() => void refreshPantheon()}
                    disabled={loading}
                    title="Refresh Pantheon entries from vault"
                    aria-label="Refresh Pantheon entries from vault"
                  >
                    <RotateCw size={15} />
                  </button>
                  <button
                    className="ghost-action"
                    onClick={handleAddEntryFromModal}
                    disabled={busyAction === "view" || busyAction === "restart"}
                  >
                    <FilePlus2 size={14} />
                    Add Entry
                  </button>
                  <button
                    type="button"
                    className="pantheon-modal-close"
                    onClick={handleCloseDatabase}
                    aria-label="Close Pantheon Database"
                    title="Close (Esc)"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div className="pantheon-modal-body">
                <div className="pantheon-workspace">
          <aside className="pantheon-sidebar">
            <div className="pantheon-sidebar-scroll">
              <div className="pantheon-sidebar-group">
                <p className="pantheon-sidebar-label">Categories</p>
                <div className="pantheon-sidebar-list">
                  {pantheonSections.map((section) => {
                    const visibleCount = filteredSections.find(
                      (candidate) => candidate.category === section.category
                    )?.entries.length ?? 0;
                    const isDimmed = !!searchQuery && visibleCount === 0;
                    return (
                      <button
                        key={section.category}
                        className={`pantheon-sidebar-row ${
                          viewMode === "grouped" && activeCategory === section.category ? "is-active" : ""
                        } ${isDimmed ? "is-dimmed" : ""}`}
                        onClick={() => handleCategoryJump(section.category)}
                        type="button"
                      >
                        <span>{section.title}</span>
                        <span className="pantheon-sidebar-count tabular-data">{section.entries.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pantheon-sidebar-divider"></div>

              <div className="pantheon-sidebar-group">
                <p className="pantheon-sidebar-label">View</p>
                <div className="pantheon-sidebar-list">
                  <button
                    className={`pantheon-sidebar-row ${viewMode === "recent" ? "is-active" : ""}`}
                    onClick={() => handleViewModeChange("recent")}
                    type="button"
                  >
                    <span>Recent</span>
                  </button>
                  <button
                    className={`pantheon-sidebar-row ${viewMode === "all" ? "is-active" : ""}`}
                    onClick={() => handleViewModeChange("all")}
                    type="button"
                  >
                    <span>All entries</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <div className="pantheon-main">
            <div className="pantheon-main-scroll" ref={mainScrollRef}>
              <AnimatePresence mode="wait">
                {selectedEntry ? (
                  <motion.div
                    key={`detail-${selectedEntry.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pantheon-detail-view"
                  >
                    <button
                      type="button"
                      className="pantheon-back-link"
                      onClick={() => setDetailEntryId(null)}
                    >
                      <ArrowLeft size={14} />
                      Back to {detailBackLabel}
                    </button>

                    <div className="pantheon-detail-header">
                      <h3>{selectedEntry.title}</h3>
                      <p className="pantheon-detail-meta tabular-data">
                        {entryTypeLabel(selectedEntry.sourceType)} {"\u00b7"} {selectedEntry.sourceLabel} {"\u00b7"}{" "}
                        {selectedEntry.sourceDateLabel} {"\u00b7"} {selectedEntry.wordCountLabel}
                      </p>
                    </div>

                    <div className="pantheon-entry-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {preprocessForRendering(selectedEntry.markdownBody)}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                ) : searchQuery ? (
                  <motion.div
                    key="search-results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {searchHasMatches ? (
                      <div className="pantheon-sections">
                        {filteredSections
                          .filter((section) => section.entries.length > 0)
                          .map((section) => (
                            <PantheonSectionBlock
                              key={section.category}
                              section={section}
                              expanded
                              canCollapse={false}
                              onToggle={() => undefined}
                              onSelectEntry={setDetailEntryId}
                              sectionRef={(node) => {
                                sectionRefs.current[section.category] = node;
                              }}
                            />
                          ))}
                      </div>
                    ) : (
                      <div className="pantheon-empty-search">
                        <strong>No entries match "{searchQuery}"</strong>
                        <p className="section-copy">Try searching by category, type, or source.</p>
                      </div>
                    )}
                  </motion.div>
                ) : viewMode === "recent" ? (
                  <motion.div
                    key="recent-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pantheon-flat-view"
                  >
                    <div className="pantheon-mode-header">
                      <p className="projects-title">Recent</p>
                      <span className="section-copy">{recentEntries.length} most recent entries</span>
                    </div>
                    <div className="pantheon-flat-list">
                      {recentEntries.map((entry) => (
                        <PantheonEntryRow
                          key={entry.id}
                          entry={entry}
                          onSelect={setDetailEntryId}
                          showCategory
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : viewMode === "all" ? (
                  <motion.div
                    key="all-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pantheon-flat-view"
                  >
                    <div className="pantheon-mode-header">
                      <div>
                        <p className="projects-title">All entries</p>
                        <span className="section-copy">{allEntries.length} entries</span>
                      </div>
                      <select
                        className="pantheon-sort-select"
                        value={allEntriesSort}
                        onChange={(event) => setAllEntriesSort(event.target.value as AllEntriesSort)}
                      >
                        <option value="date-desc">Newest first</option>
                        <option value="title-asc">Title A-Z</option>
                      </select>
                    </div>
                    <div className="pantheon-flat-list">
                      {allEntries.map((entry) => (
                        <PantheonEntryRow
                          key={entry.id}
                          entry={entry}
                          onSelect={setDetailEntryId}
                          showCategory
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="grouped-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pantheon-sections"
                  >
                    {pantheonSections.map((section) => (
                      <PantheonSectionBlock
                        key={section.category}
                        section={section}
                        expanded={expandedSections[section.category]}
                        canCollapse
                        onToggle={() => handleSectionToggle(section.category)}
                        onSelectEntry={setDetailEntryId}
                        sectionRef={(node) => {
                          sectionRefs.current[section.category] = node;
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function PantheonSectionBlock({
  section,
  expanded,
  canCollapse,
  onToggle,
  onSelectEntry,
  sectionRef
}: {
  section: PantheonSection;
  expanded: boolean;
  canCollapse: boolean;
  onToggle: () => void;
  onSelectEntry: (entryId: string) => void;
  sectionRef: (node: HTMLDivElement | null) => void;
}) {
  const headerCountLabel = `${section.entries.length} ${section.entries.length === 1 ? "entry" : "entries"}`;

  return (
    <section className="pantheon-section" aria-label={section.title}>
      <div
        ref={sectionRef}
        data-category={section.category}
        className="pantheon-section-header"
      >
        <button
          type="button"
          className="pantheon-section-toggle"
          onClick={canCollapse ? onToggle : undefined}
          disabled={!canCollapse}
        >
          <span className={`pantheon-section-chevron ${expanded ? "is-expanded" : ""}`}>
            <ChevronDown size={12} />
          </span>
          <span className="pantheon-section-heading">
            <span className="projects-title">{section.title}</span>
            <span className="pantheon-section-count-inline">{headerCountLabel}</span>
          </span>
          <span className="pantheon-section-description">{section.description}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={`${section.category}-entries`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pantheon-entry-list"
          >
            {section.entries.length > 0 ? (
              section.entries.map((entry) => (
                <PantheonEntryRow key={entry.id} entry={entry} onSelect={onSelectEntry} />
              ))
            ) : (
              <div className="pantheon-empty-section">
                <span>No entries yet.</span>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function PantheonEntryRow({
  entry,
  onSelect,
  showCategory = false
}: {
  entry: PreparedPantheonEntry;
  onSelect: (entryId: string) => void;
  showCategory?: boolean;
}) {
  return (
    <button
      type="button"
      className="pantheon-entry-row"
      onClick={() => onSelect(entry.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(entry.id);
        }
      }}
      aria-label={`Open Pantheon entry ${entry.title}`}
    >
      {showCategory ? (
        <span className="pantheon-inline-category">{categoryLabel(entry.category)}</span>
      ) : null}
      <div className="pantheon-entry-row-top">
        <strong>{entry.title}</strong>
        <div className="pantheon-entry-row-meta">
          <span className="tabular-data">{entry.wordCountLabel}</span>
          <span className="tabular-data pantheon-entry-date">{entry.sourceDateLabel}</span>
        </div>
      </div>
      <div className="pantheon-entry-row-bottom">
        <span className={`pantheon-type-tag pantheon-type-${entry.sourceType}`}>
          {entryTypeLabel(entry.sourceType)}
        </span>
        <span className="pantheon-entry-source">{entry.sourceLabel}</span>
      </div>
    </button>
  );
}

function prepareEntry(entry: ResearchRecord): PreparedPantheonEntry {
  const parsed = parseEntryContent(entry.content);
  return {
    ...entry,
    sourceLabel: parsed.sourceLabel,
    markdownBody: parsed.markdownBody,
    sourceDateLabel: formatShortDate(entry.sourceDate || entry.createdAt),
    wordCountLabel: `${formatWordCount(entry.wordCount)} words`
  };
}

function buildSections(entries: PreparedPantheonEntry[]): PantheonSection[] {
  const buckets = new Map<PantheonCategory, PantheonSection>();

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

  return Array.from(buckets.values()).map((section) => ({
    ...section,
    entries: [...section.entries].sort(compareEntriesByDateDesc)
  }));
}

function buildEntryLabel(entries: PreparedPantheonEntry[]): string {
  const countLabel = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  if (entries.length === 0) return countLabel;

  const latest = [...entries]
    .map((entry) => entry.createdAt ?? entry.sourceDate)
    .filter(Boolean)
    .sort();

  const latestValue = latest[latest.length - 1];
  if (!latestValue) return countLabel;

  return `${countLabel} \u00b7 Updated ${formatShortDate(latestValue)}`;
}

function loadExpandedSections(): Record<PantheonCategory, boolean> {
  const defaults = orderedCategories().reduce(
    (accumulator, category) => ({
      ...accumulator,
      [category]: false
    }),
    {} as Record<PantheonCategory, boolean>
  );
  orderedCategories().forEach((category, index) => {
    const stored = window.localStorage.getItem(`${SECTION_STORAGE_PREFIX}${category}`);
    if (stored === "true" || stored === "false") {
      defaults[category] = stored === "true";
    } else {
      defaults[category] = index < 2;
    }
  });
  return defaults;
}

function persistExpandedState(category: PantheonCategory, expanded: boolean) {
  window.localStorage.setItem(`${SECTION_STORAGE_PREFIX}${category}`, String(expanded));
}

function buildCategoryRefRecord<T>(fallback: T | null = null): Record<PantheonCategory, T | null> {
  return orderedCategories().reduce(
    (accumulator, category) => ({
      ...accumulator,
      [category]: fallback
    }),
    {} as Record<PantheonCategory, T | null>
  );
}

function compareEntriesByDateDesc(left: PreparedPantheonEntry, right: PreparedPantheonEntry): number {
  const leftTime = Date.parse(left.sourceDate || left.createdAt);
  const rightTime = Date.parse(right.sourceDate || right.createdAt);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return right.createdAt.localeCompare(left.createdAt);
  }
  return rightTime - leftTime;
}

function matchesSearch(entry: PreparedPantheonEntry, query: string): boolean {
  const needle = query.toLowerCase();
  return [
    entry.title,
    categoryLabel(entry.category),
    entry.sourceType,
    entry.sourceLabel
  ].some((value) => value.toLowerCase().includes(needle));
}

function parseEntryContent(content: string): { markdownBody: string; sourceLabel: string } {
  try {
    const parsed = matter(content);
    const data = parsed.data as Record<string, unknown>;
    const sourceLabel =
      findFirstString(data.source, data.source_name, data.origin, data.channel, data.publisher) ??
      "Local source";
    return {
      markdownBody: parsed.content.trim() || content.trim(),
      sourceLabel
    };
  } catch {
    return {
      markdownBody: content.trim(),
      sourceLabel: "Local source"
    };
  }
}

function findFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatWordCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function entryTypeLabel(sourceType: ResearchRecord["sourceType"]): string {
  switch (sourceType) {
    case "manual":
      return "PROCEDURE";
    default:
      return sourceType.toUpperCase();
  }
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

function pantheonEntryToResearchRecord(entry: PantheonEntry): ResearchRecord {
  const sourceType = mapPantheonSourceType(entry.sourceType ?? entry.entryType);
  const createdAt = entry.created ?? entry.fileModifiedAt.slice(0, 10);
  const sourceDate = entry.sourceDate ?? createdAt;
  const wordCount = entry.wordCount;

  const baseRecord: ResearchRecord = {
    id: entry.id,
    title: entry.title,
    sourceType,
    createdAt,
    sourceDate,
    tags: entry.tags,
    summary: "",
    content: entry.body || entry.bodyPreview,
    category: "general-reference",
    categoryReason: "",
    themes: [],
    wordCount,
    estReadMinutes: Math.max(1, Math.ceil(wordCount / 220)),
    freshness: "recent"
  };

  return normalizeResearchRecord(baseRecord);
}

function preprocessObsidianCallouts(body: string): string {
  return body.replace(
    /^> \[!(\w+)\](?: (.*))?$/gm,
    (_, type, title) => `> **${(title || String(type)).toUpperCase()}**\n>`
  );
}

function preprocessWikilinks(body: string): string {
  return body.replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
    const display = String(target).split("|").pop() ?? String(target);
    return `<span class="pantheon-wikilink">${display}</span>`;
  });
}

function preprocessForRendering(body: string): string {
  return preprocessWikilinks(preprocessObsidianCallouts(body));
}
