import { invoke } from "@tauri-apps/api/core";
import matter from "gray-matter";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  FilePlus2,
  Layers3,
  Library,
  RotateCcw,
  RotateCw,
  Search
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  PANTHEON_ORIGINS,
  PANTHEON_STANCES,
  usePantheon,
  type PantheonOrigin,
  type PantheonStance
} from "../../hooks/usePantheon";
import { restartDesktopApp } from "../../services/launcher";
import {
  categoryDescription,
  categoryLabel,
  orderedCategories
} from "../../services/pantheonAnalysis";
import { pantheonEntryToResearchRecord } from "../../services/pantheonRecord";
import type { ObsidianActionResult } from "../../services/obsidian";
import type { PantheonCategory, ResearchRecord } from "../../types";

interface LibraryPanelProps {
  onViewDatabase: () => Promise<ObsidianActionResult>;
  /** Research mode: the library lives in the centre column instead of a modal. */
  resident?: boolean;
}

interface WritePantheonEntryRequest {
  title: string;
  body: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceDate?: string;
  additionalTags: string[];
  attachments: string[];
  stance?: PantheonStance;
  whyKept?: string;
  origin?: PantheonOrigin;
  project?: string;
}

/** Mirrors `MigrationOutcome` in `commands/pantheon_migrate.rs`. */
interface MigrationOutcome {
  migrated: string[];
  alreadyCurrent: string[];
  declined: string[];
  failed: string[];
}

interface StagedAttachment {
  sourcePath: string;
  originalFilename: string;
  sizeBytes: number;
  extension: string;
}

interface AddEntryFormData {
  title: string;
  body: string;
  sourceType: string;
  sourceUrl: string;
  sourceDate: string;
  tagsRaw: string;
  attachment: StagedAttachment | null;
  stance: PantheonStance;
  whyKept: string;
  origin: PantheonOrigin;
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

export function LibraryPanel({ onViewDatabase, resident = false }: LibraryPanelProps) {
  const { entries: pantheonEntries, loading, error, refresh: refreshPantheon } = usePantheon();
  const [addEntryModalOpen, setAddEntryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [databaseRequested, setDatabaseRequested] = useState(false);
  // Research mode holds the library open in the centre column; every other mode
  // opens it on request. Derived rather than an effect, so leaving the mode
  // closes it without a second piece of state to keep in step.
  const databaseOpen = resident || databaseRequested;
  const setDatabaseOpen = setDatabaseRequested;
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<"view" | "restart" | null>(null);
  const [migrating, setMigrating] = useState(false);
  // An entry written before the schema change parses with no origin at all —
  // the parser drops its legacy writer value rather than reading it as one.
  const unmigratedCount = pantheonEntries.filter((entry) => !entry.origin).length;
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
    if (!addEntryModalOpen) return;
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault();
        setAddEntryModalOpen(false);
        setFormError(null);
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [addEntryModalOpen, submitting]);

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

  async function handleAddEntrySave(formData: AddEntryFormData) {
    setFormError(null);
    if (!formData.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formData.body.trim()) {
      setFormError("Body content is required.");
      return;
    }

    setSubmitting(true);
    try {
      let attachments: string[] = [];
      if (formData.attachment) {
        try {
          const writtenAttachmentPath = await invoke<string>("save_attachment_to_vault", {
            sourcePath: formData.attachment.sourcePath,
            targetFilename: formData.attachment.originalFilename
          });
          attachments = [writtenAttachmentPath];
        } catch (err) {
          setFormError(`Failed to save attachment: ${err}`);
          setSubmitting(false);
          return;
        }
      }

      const request: WritePantheonEntryRequest = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        sourceType: formData.sourceType.trim() || undefined,
        sourceUrl: formData.sourceUrl.trim() || undefined,
        sourceDate: formData.sourceDate.trim() || undefined,
        additionalTags: parseTagsInput(formData.tagsRaw),
        attachments,
        stance: formData.stance,
        // Omitted rather than sent empty: the backend distinguishes "no purpose
        // stated" from "purpose stated as nothing", and so does the operator.
        whyKept: formData.whyKept.trim() || undefined,
        origin: formData.origin
      };
      const writtenPath = await invoke<string>("write_pantheon_entry", { req: request });
      setStatus({
        tone: "success",
        message: `Saved to ${writtenPath}`,
        path: writtenPath
      });
      setAddEntryModalOpen(false);
      void refreshPantheon();
    } catch (err) {
      setFormError(`Failed to save entry: ${err}`);
    } finally {
      setSubmitting(false);
    }
  }

  function openAddEntryModal() {
    setFormError(null);
    setAddEntryModalOpen(true);
  }

  function closeAddEntryModal() {
    if (submitting) return;
    setAddEntryModalOpen(false);
    setFormError(null);
  }

  async function handleMigrateSchema() {
    setMigrating(true);
    try {
      const outcome = await invoke<MigrationOutcome>("migrate_pantheon_schema");
      const parts = [`${outcome.migrated.length} migrated`];
      if (outcome.declined.length) parts.push(`${outcome.declined.length} declined`);
      if (outcome.failed.length) parts.push(`${outcome.failed.length} failed`);

      setStatus({
        // A declined write is a correct outcome, so only a real failure is an error.
        tone: outcome.failed.length ? "error" : "success",
        message: outcome.failed.length
          ? `${parts.join(", ")} — ${outcome.failed.join("; ")}`
          : parts.join(", "),
        path: ""
      });
      void refreshPantheon();
    } catch (err) {
      setStatus({ tone: "error", message: `Migration failed: ${err}`, path: "" });
    } finally {
      setMigrating(false);
    }
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
    openAddEntryModal();
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
      {/* Header-only in residence: the library itself opens as a modal, so the
          resident panel is a single strip rather than a full-height panel
          reporting a count. Research mode drops the strip — the full library is
          already in the column below and would repeat every one of these. */}
      {resident ? null : (
      <section className="dashboard-panel research-panel pantheon-panel is-collapsed surface-chrome">
        <div className="panel-head">
          <span className="panel-head__icon">
            <Library size={15} />
          </span>
          <p className="panel-head__title">Pantheon</p>
          <span className="panel-head__meta">{entryLabel}</span>

          <div className="panel-head__actions">
            {/* Only while there is something to migrate. An entry written before
                the schema change parses with no origin at all, because the
                parser refuses to read its writer as one. */}
            {unmigratedCount > 0 ? (
              <button
                className="ghost-action"
                onClick={() => void handleMigrateSchema()}
                disabled={migrating || submitting}
                title="Move legacy origin values to written_by and state the fields these entries were written without"
              >
                <RotateCw size={15} />
                {migrating
                  ? "Awaiting approval..."
                  : `Migrate ${unmigratedCount} ${unmigratedCount === 1 ? "entry" : "entries"}`}
              </button>
            ) : null}
            <button
              className="ghost-action"
              onClick={() => void handleViewDatabase()}
              disabled={submitting || busyAction === "restart"}
            >
              <Layers3 size={15} />
              {busyAction === "view" ? "Refreshing..." : "View Database"}
            </button>
            <button
              className="ghost-action"
              onClick={openAddEntryModal}
              disabled={busyAction === "view" || busyAction === "restart"}
            >
              <FilePlus2 size={15} />
              Add Entry
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

      </section>
      )}

      {addEntryModalOpen &&
        createPortal(
          <AddEntryModal
            onClose={closeAddEntryModal}
            onSubmit={handleAddEntrySave}
            submitting={submitting}
            formError={formError}
          />,
          document.body
        )}

      {databaseOpen &&
        inSurface(
          resident,
          <div
            className={resident ? "pantheon-resident-shell" : "pantheon-modal-backdrop"}
            onClick={resident ? undefined : handleCloseDatabase}
          >
            <div
              className={resident ? "dashboard-panel pantheon-resident" : "pantheon-modal"}
              role={resident ? undefined : "dialog"}
              aria-label={resident ? undefined : "Pantheon Database"}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="pantheon-modal-header">
                <div className="pantheon-modal-title-group">
                  <h2 className="pantheon-modal-title">Pantheon Database</h2>
                  <span className="pantheon-modal-meta">{entryLabel}</span>
                </div>
                <div className="pantheon-modal-actions">
                  {/* Resident mode has no strip above it to carry this, and an
                      entry that still needs migrating should not go quiet just
                      because the library changed where it lives. */}
                  {resident && unmigratedCount > 0 ? (
                    <button
                      className="ghost-action"
                      onClick={() => void handleMigrateSchema()}
                      disabled={migrating || submitting}
                      title="Move legacy origin values to written_by and state the fields these entries were written without"
                    >
                      <RotateCw size={15} />
                      {migrating
                        ? "Awaiting approval..."
                        : `Migrate ${unmigratedCount} ${unmigratedCount === 1 ? "entry" : "entries"}`}
                    </button>
                  ) : null}
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
                  {/* Nothing to close in residence — the mode switcher is what
                      leaves. A close button that emptied the centre column
                      would strand Research mode on a blank panel. */}
                  {resident ? null : (
                    <button
                      type="button"
                      className="pantheon-modal-close"
                      onClick={handleCloseDatabase}
                      aria-label="Close Pantheon Database"
                      title="Close (Esc)"
                    >
                      ×
                    </button>
                  )}
                </div>
              </header>

              {/* In residence there is no strip above to report these, and a
                  migration that says nothing about how it went is worse than
                  one that never ran. */}
              {resident && status ? (
                <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>
              ) : null}
              {resident && error ? (
                <p className="pantheon-error">Couldn't read vault entries: {error}</p>
              ) : null}

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
                      {/* Stated, not implied. An entry with no declared purpose
                          should look different from one the operator justified \u2014
                          otherwise the library reads as uniformly endorsed. */}
                      <p className="pantheon-detail-judgement">
                        <span className={`pantheon-stance is-${selectedEntry.stance ?? "unevaluated"}`}>
                          {selectedEntry.stance ?? "unevaluated"}
                        </span>
                        {selectedEntry.origin ? (
                          <span className="pantheon-origin">{selectedEntry.origin}</span>
                        ) : null}
                        <span
                          className={`pantheon-why-kept ${selectedEntry.whyKept ? "" : "is-absent"}`}
                        >
                          {selectedEntry.whyKept ?? "No stated purpose"}
                        </span>
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
          </div>
        )}
    </>
  );
}

/**
 * Resident renders in place; otherwise the library goes to a portal exactly as
 * it always has. One wrapper decision, so the surface inside it has no idea
 * which mode it is in and cannot drift between the two.
 */
function inSurface(resident: boolean, node: ReactElement): ReactNode {
  return resident ? node : createPortal(node, document.body);
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

// Title and tags, plus what was already here. Bodies are deliberately not
// searched: the assistant cannot read them either, and a search that reaches
// further than the model does would suggest it knows more than it has seen.
function matchesSearch(entry: PreparedPantheonEntry, query: string): boolean {
  const needle = query.toLowerCase();
  return [
    entry.title,
    categoryLabel(entry.category),
    entry.sourceType,
    entry.sourceLabel,
    ...(entry.tags ?? [])
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

function parseTagsInput(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function entryTypeLabel(sourceType: ResearchRecord["sourceType"]): string {
  switch (sourceType) {
    case "manual":
      return "PROCEDURE";
    default:
      return sourceType.toUpperCase();
  }
}

const ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"];

function AddEntryModal({
  onClose,
  onSubmit,
  submitting,
  formError
}: {
  onClose: () => void;
  onSubmit: (formData: AddEntryFormData) => void | Promise<void>;
  submitting: boolean;
  formError: string | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceType, setSourceType] = useState("article");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tagsRaw, setTagsRaw] = useState("");
  // Defaults that assert nothing. Saving a source is not agreeing with it, and
  // the capture form is the operator's own hand, so `collected` is true here.
  const [stance, setStance] = useState<PantheonStance>("unevaluated");
  const [whyKept, setWhyKept] = useState("");
  const [origin, setOrigin] = useState<PantheonOrigin>("collected");
  const [attachment, setAttachment] = useState<StagedAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  async function handlePickAttachment() {
    setAttachmentError(null);
    try {
      const picked = await invoke<string | null>("pick_attachment_file");
      if (!picked) return;

      const filename = picked.split(/[\\/]/).pop() ?? picked;
      const ext = filename.includes(".")
        ? filename.split(".").pop()?.toLowerCase() ?? ""
        : "";
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        setAttachmentError(
          `File type not allowed. Allowed: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}.`
        );
        return;
      }

      const staged: StagedAttachment = {
        sourcePath: picked,
        originalFilename: filename,
        sizeBytes: 0,
        extension: ext
      };
      setAttachment(staged);
      setExtractedText(null);
      setExtractError(null);

      if (ext === "pdf") {
        setExtracting(true);
        try {
          const text = await invoke<string>("extract_pdf_text", { filePath: picked });
          if (!text || text.trim().length === 0) {
            setExtractedText("");
            setExtractError("No text extracted (likely a scanned PDF).");
          } else {
            setExtractedText(text);
          }
        } catch (err) {
          setExtractedText(null);
          setExtractError(String(err));
        } finally {
          setExtracting(false);
        }
      }
    } catch (err) {
      setAttachmentError(`Failed to pick file: ${err}`);
    }
  }

  function handleRemoveAttachment() {
    setAttachment(null);
    setExtractedText(null);
    setExtractError(null);
    setAttachmentError(null);
    setExtracting(false);
  }

  function handleInsertExtracted() {
    if (!extractedText) return;
    const trimmedBody = body.trim();
    setBody(trimmedBody.length > 0 ? `${trimmedBody}\n\n${extractedText}` : extractedText);
  }

  // Named so the footer can say which one is holding it, rather than leaving a
  // dead button and no explanation.
  const missing = [
    !title.trim() ? "Title" : null,
    !body.trim() ? "Body" : null
  ].filter((value): value is string => value !== null);

  function handleSave() {
    void onSubmit({
      title,
      body,
      sourceType,
      sourceUrl,
      sourceDate,
      tagsRaw,
      attachment,
      stance,
      whyKept,
      origin
    });
  }

  return (
    <div className="pantheon-modal-backdrop" onClick={onClose}>
      <div
        className="pantheon-modal pantheon-modal--add-entry"
        role="dialog"
        aria-label="Add Pantheon entry"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pantheon-modal-header">
          <div className="pantheon-modal-title-group">
            <h2 className="pantheon-modal-title">Add Entry</h2>
            <span className="pantheon-modal-meta">New Pantheon entry</span>
          </div>
          <button
            type="button"
            className="pantheon-modal-close"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            disabled={submitting}
          >
            ×
          </button>
        </header>

        <div className="pantheon-modal-body pantheon-modal-body--form">
          {formError ? <div className="composer-error">{formError}</div> : null}

          <div className="add-entry-form">
            <div className="form-field">
              <label className="form-label" htmlFor="ae-title">
                Title
              </label>
              <input
                id="ae-title"
                type="text"
                className="form-input"
                placeholder="Entry title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
                disabled={submitting}
              />
            </div>

            {/* Second, not last. This is the entry — the metadata below it
                describes the thing typed here. It used to sit under nine other
                fields including the attachment dropzone, far enough below the
                fold that the form read as upload-only and Save looked
                permanently dead. */}
            <div className="form-field form-field--body">
              <label className="form-label" htmlFor="ae-body">
                Body
              </label>
              <textarea
                id="ae-body"
                className="form-input form-textarea"
                placeholder="Write or paste the entry. Markdown supported. An attachment below can be extracted into this field, but typing here is the normal path."
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
                disabled={submitting}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="ae-source-type">
                Source type
              </label>
              <select
                id="ae-source-type"
                className="form-input"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                disabled={submitting}
              >
                <option value="article">Article</option>
                <option value="transcript">Transcript</option>
                <option value="guide">Guide</option>
                <option value="paper">Paper</option>
                <option value="talk">Talk</option>
                <option value="">Other / unspecified</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="ae-source-url">
                  Source URL <span className="form-optional">(optional)</span>
                </label>
                <input
                  id="ae-source-url"
                  type="url"
                  className="form-input"
                  placeholder="https://..."
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="ae-source-date">
                  Source date <span className="form-optional">(optional)</span>
                </label>
                <input
                  id="ae-source-date"
                  type="date"
                  className="form-input"
                  value={sourceDate}
                  onChange={(event) => setSourceDate(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="ae-tags">
                Tags <span className="form-optional">(optional)</span>
              </label>
              <input
                id="ae-tags"
                type="text"
                className="form-input"
                placeholder="comma, separated, tags"
                value={tagsRaw}
                onChange={(event) => setTagsRaw(event.target.value)}
                disabled={submitting}
              />
              <span className="form-helper">
                <code>olympus/research</code> and <code>{`research/${sourceType || "TYPE"}`}</code>{" "}
                are added automatically.
              </span>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="ae-stance">
                  Stance
                </label>
                <select
                  id="ae-stance"
                  className="form-input"
                  value={stance}
                  onChange={(event) => setStance(event.target.value as PantheonStance)}
                  disabled={submitting}
                >
                  {PANTHEON_STANCES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="form-helper">
                  Saving a source is not agreeing with it. Left alone, this stays{" "}
                  <code>unevaluated</code>.
                </span>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="ae-origin">
                  Origin
                </label>
                <select
                  id="ae-origin"
                  className="form-input"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value as PantheonOrigin)}
                  disabled={submitting}
                >
                  {PANTHEON_ORIGINS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="form-helper">
                  Who found it. Sources Olympus surfaced stay distinguishable from your own.
                </span>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="ae-why-kept">
                Why kept <span className="form-optional">(optional)</span>
              </label>
              <input
                id="ae-why-kept"
                type="text"
                className="form-input"
                placeholder="What this is for."
                value={whyKept}
                onChange={(event) => setWhyKept(event.target.value)}
                disabled={submitting}
              />
              <span className="form-helper">
                Left blank, the entry reads as having no stated purpose — which is visible rather
                than guessed at.
              </span>
            </div>

            <div className="form-field">
              <label className="form-label">
                Attachment <span className="form-optional">(optional)</span>
              </label>
              {attachment ? (
                <div className="attachment-staged-row">
                  <span className="attachment-staged-name">{attachment.originalFilename}</span>
                  <span className="attachment-staged-ext">{attachment.extension.toUpperCase()}</span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={handleRemoveAttachment}
                    disabled={submitting}
                    aria-label="Remove attachment"
                    title="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="attachment-dropzone"
                  onClick={() => void handlePickAttachment()}
                  disabled={submitting}
                >
                  Drop a file here, or click to browse
                </button>
              )}
              {attachmentError ? (
                <span className="form-helper attachment-error-text">{attachmentError}</span>
              ) : (
                <span className="form-helper">
                  Allowed: {ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}. Files copy into{" "}
                  <code>02 - Research/_attachments/</code>.
                </span>
              )}

              {attachment && attachment.extension === "pdf" ? (
                <div className="attachment-preview">
                  <div className="attachment-preview-header">
                    <span>PDF text preview</span>
                    {extractedText && extractedText.length > 0 ? (
                      <button
                        type="button"
                        className="attachment-insert-button"
                        onClick={handleInsertExtracted}
                        disabled={submitting}
                        title="Append extracted text to body"
                      >
                        Insert into body
                      </button>
                    ) : null}
                  </div>
                  <div className="attachment-preview-body">
                    {extracting ? (
                      <span className="attachment-preview-status">Extracting…</span>
                    ) : extractError ? (
                      <span className="attachment-preview-status attachment-preview-error">
                        {extractError}
                      </span>
                    ) : extractedText && extractedText.length > 0 ? (
                      <pre className="attachment-preview-text">{extractedText}</pre>
                    ) : (
                      <span className="attachment-preview-status">No text yet.</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="pantheon-modal-footer">
          {/* A disabled button that will not say what it is waiting for is the
              worst affordance in the form. The footer is pinned, so this was
              visible and inert while the field it wanted sat below the fold. */}
          {missing.length > 0 && !submitting ? (
            <span className="pantheon-modal-footer-hint">
              {missing.length === 1
                ? `${missing[0]} is required`
                : `${missing.join(" and ")} are required`}
            </span>
          ) : null}
          <button
            type="button"
            className="form-button form-button--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="form-button form-button--primary"
            onClick={handleSave}
            disabled={submitting || missing.length > 0}
            title={missing.length > 0 ? `Still needed: ${missing.join(", ")}` : undefined}
          >
            {submitting ? "Saving..." : "Save Entry"}
          </button>
        </footer>
      </div>
    </div>
  );
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
