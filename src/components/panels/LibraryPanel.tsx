import { invoke } from "@tauri-apps/api/core";
import { FilePlus2, Layers3, Library, RotateCw, Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePantheon } from "../../hooks/usePantheon";
import type { ResearchInspectionTarget } from "../../services/commandAgents";
import { useNavigationTarget } from "../../services/navigation";
import type { ObsidianActionResult } from "../../services/obsidian";
import { anotherModalIsOpen, isEditableTarget, SHORTCUTS } from "../../services/shortcuts";
import { useViewSlice, type ResearchArrival } from "../../state/viewState";
import type { TrackedProject } from "../../types";
import { KnowledgeAudit } from "./KnowledgeAudit";
import { ResearchVerification } from "./ResearchVerification";
import { AddEntryDialog } from "./library/AddEntryDialog";
import type { LibraryProject } from "./library/EntryDetail";
import { LibraryBrowser } from "./library/LibraryBrowser";
import { findEntryBySourceFile, latestAddedLabel, prepareEntries } from "./library/libraryModel";
import "./library/library.css";

interface LibraryPanelProps {
  inspectionTarget?: ResearchInspectionTarget | null;
  onReturnToCommand?: () => void;
  onViewDatabase: () => Promise<ObsidianActionResult>;
  /** Research mode: the library lives in the centre column instead of a modal. */
  resident?: boolean;
  /** Tracked projects, for the Add Entry project select and the detail's project link. */
  projects?: Pick<TrackedProject, "id" | "name" | "notePath">[];
}

/** Mirrors `MigrationOutcome` in `commands/pantheon_migrate.rs`. */
interface MigrationOutcome {
  migrated: string[];
  alreadyCurrent: string[];
  declined: string[];
  failed: string[];
}

type Segment = "library" | "questions" | "audits";

const SEGMENTS: { id: Segment; label: string; suffix?: string; accessible: string }[] = [
  { id: "library", label: "Library", accessible: "Library" },
  { id: "questions", label: "Questions", suffix: "verified", accessible: "Questions (verified)" },
  { id: "audits", label: "Audits", accessible: "Audits" }
];

const NO_PROJECTS: LibraryPanelProps["projects"] = [];

export function LibraryPanel({ onViewDatabase, resident = false, inspectionTarget, onReturnToCommand, projects = NO_PROJECTS }: LibraryPanelProps) {
  const { entries: raw, loading, error, refresh: refreshPantheon } = usePantheon();
  const [research, setResearch] = useViewSlice("research");
  const segment: Segment = research.inspector ?? "library";
  const entries = useMemo(() => prepareEntries(raw), [raw]);
  // The input answers every keystroke; the list follows when it can.
  const deferredQuery = useDeferredValue(research.query);
  const [databaseRequested, setDatabaseRequested] = useState(false);
  // Research mode holds the library open in the centre column; every other mode
  // opens it on request. Derived rather than an effect, so leaving the mode
  // closes it without a second piece of state to keep in step.
  const databaseOpen = resident || databaseRequested;
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<"view" | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [openToken, setOpenToken] = useState(0);
  const [visited, setVisited] = useState<Set<Segment>>(() => new Set([segment]));
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const databaseDialogRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const inspectorRefs = useRef<Partial<Record<Segment, HTMLDivElement | null>>>({});
  const inspectorScroll = useRef<Partial<Record<Segment, number>>>({});
  const returnFocus = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<"search" | "return" | null>(null);
  const libraryProjects = useMemo<LibraryProject[]>(
    () => (projects ?? []).map((project) => ({ id: project.id, name: project.name, notePath: project.notePath ?? null })),
    [projects]
  );
  // An entry written before the schema change parses with no origin at all —
  // the parser drops its legacy writer value rather than reading it as one.
  const unmigratedCount = useMemo(() => raw.filter((entry) => !entry.origin).length, [raw]);
  const entryLabel = useMemo(() => {
    if (loading && raw.length === 0) return "Loading entries…";
    const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
    const latest = latestAddedLabel(entries);
    return latest ? `${count} · last added ${latest}` : count;
  }, [entries, loading, raw.length]);

  const selectSegment = useCallback((next: Segment) => {
    const current = readSegment();
    const node = inspectorRefs.current[current];
    if (current !== "library" && node) inspectorScroll.current[current] = node.scrollTop;
    setVisited((previous) => (previous.has(next) ? previous : new Set(previous).add(next)));
    setResearch((state) => ((state.inspector ?? "library") === next ? state : { ...state, inspector: next }));
  }, [setResearch]);
  const segmentRef = useRef(segment);
  segmentRef.current = segment;
  const readSegment = () => segmentRef.current;

  // A hidden segment loses its scroll position; put it back when shown again,
  // and move focus where the last action asked for it.
  useLayoutEffect(() => {
    if (segment !== "library") {
      const node = inspectorRefs.current[segment];
      if (node) node.scrollTop = inspectorScroll.current[segment] ?? 0;
    }
    if (pendingFocus.current === "search" && segment === "library") {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    } else if (pendingFocus.current === "return" && returnFocus.current?.isConnected) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current.scrollIntoView({ block: "nearest" });
    }
    pendingFocus.current = null;
  }, [segment]);

  // Command-catalog deep links open the verified questions (review U7).
  const handledInspection = useRef<number | null>(null);
  useEffect(() => {
    if (!inspectionTarget) {
      handledInspection.current = null;
      return;
    }
    if (handledInspection.current === inspectionTarget.revision) return;
    handledInspection.current = inspectionTarget.revision;
    selectSegment("questions");
  }, [inspectionTarget, selectSegment]);

  const openArrival = useCallback((arrival: ResearchArrival) => {
    const entry = findEntryBySourceFile(entries, arrival.sourceFile);
    setVisited((previous) => (previous.has("library") ? previous : new Set(previous).add("library")));
    setResearch((state) => ({
      ...state,
      inspector: "library",
      detailEntryId: entry?.id ?? null,
      arrival: { ...arrival, title: arrival.title ?? entry?.title ?? arrival.sourceFile.split("/").pop()?.replace(/\.md$/i, "") }
    }));
    setOpenToken((token) => token + 1);
  }, [entries, setResearch]);

  // The destination for "Open in library" from a chat reply (review U5).
  const [navigationTarget, consumeNavigation] = useNavigationTarget("research");
  useEffect(() => {
    if (!resident || !navigationTarget) return;
    // Wait for the first scan, so a source is not reported missing before the
    // library has been read.
    if (loading && raw.length === 0) return;
    returnFocus.current = null;
    openArrival({
      sourceFile: navigationTarget.sourceFile,
      excerpt: navigationTarget.excerpt,
      fingerprint: navigationTarget.fingerprint,
      context: "reply"
    });
    consumeNavigation(navigationTarget.revision);
  }, [consumeNavigation, loading, navigationTarget, openArrival, raw.length, resident]);

  const openEntry = useCallback((id: string) => {
    setResearch((state) => ({ ...state, detailEntryId: id, arrival: null }));
    setOpenToken((token) => token + 1);
  }, [setResearch]);

  const back = useCallback(() => {
    const returnTo = research.arrival?.returnTo;
    setResearch((state) => ({ ...state, detailEntryId: null, arrival: null }));
    if (returnTo) {
      pendingFocus.current = "return";
      selectSegment(returnTo);
    }
  }, [research.arrival?.returnTo, selectSegment, setResearch]);

  const openFromInspector = useCallback((context: "verification" | "audit", from: Segment) => (target: { sourceFile: string; excerpt?: string; fingerprint?: string; title?: string }) => {
    const active = document.activeElement;
    returnFocus.current = active instanceof HTMLElement ? active : null;
    const node = inspectorRefs.current[from];
    if (node) inspectorScroll.current[from] = node.scrollTop;
    openArrival({ ...target, context, returnTo: from === "questions" ? "questions" : "audits" });
  }, [openArrival]);
  const openFromQuestions = useMemo(() => openFromInspector("verification", "questions"), [openFromInspector]);
  const openFromAudits = useMemo(() => openFromInspector("audit", "audits"), [openFromInspector]);
  const hasEntry = useCallback((sourceFile: string) => findEntryBySourceFile(entries, sourceFile) !== null, [entries]);

  function setQuery(value: string) {
    setResearch((state) => ({ ...state, query: value, detailEntryId: value.trim() ? null : state.detailEntryId, arrival: value.trim() ? null : state.arrival }));
  }

  useEffect(() => {
    if (!databaseOpen) return;

    function handleKeydown(event: KeyboardEvent) {
      if (anotherModalIsOpen(resident ? null : databaseDialogRef.current)) return;

      // Ctrl+K belongs to the console in every mode; search is `/`, and only
      // when the key would not otherwise be typed into a field.
      if (SHORTCUTS.librarySearch.matches(event) && !isEditableTarget(event.target)) {
        event.preventDefault();
        if (readSegment() !== "library") {
          pendingFocus.current = "search";
          selectSegment("library");
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
        return;
      }

      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      // Only for keys pressed in the library or on nothing in particular; the
      // console and other panels own their own Escape.
      const target = event.target as Node | null;
      const inside = target === document.body || (target !== null && surfaceRef.current?.contains(target));
      if (!inside) return;
      const state = research;
      if (target === searchInputRef.current && state.query) {
        event.preventDefault();
        setQuery("");
      } else if (readSegment() === "library" && (state.detailEntryId || state.arrival)) {
        event.preventDefault();
        back();
      } else if (state.query && readSegment() === "library") {
        event.preventDefault();
        setQuery("");
      } else if (!resident) {
        event.preventDefault();
        setDatabaseRequested(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

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
        message: outcome.failed.length ? `${parts.join(", ")} — ${outcome.failed.join("; ")}` : parts.join(", "),
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
    setDatabaseRequested(true);
  }

  function handleSaved(path: string) {
    setAddEntryOpen(false);
    setStatus({ tone: "success", message: `Saved to ${path}`, path });
    void refreshPantheon();
  }

  function onSegmentKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? SEGMENTS.length - 1 : null;
    if (!delta && edge === null) return;
    event.preventDefault();
    const nextIndex = edge ?? (index + delta + SEGMENTS.length) % SEGMENTS.length;
    selectSegment(SEGMENTS[nextIndex].id);
    document.getElementById(`library-tab-${SEGMENTS[nextIndex].id}`)?.focus();
  }

  const migrateNotice = unmigratedCount > 0 ? (
    <div className="library-notice" role="status">
      <span>
        {unmigratedCount} {unmigratedCount === 1 ? "entry was" : "entries were"} written before stance and origin were recorded.
      </span>
      <button
        type="button"
        className="ghost-action library-action"
        onClick={() => void handleMigrateSchema()}
        disabled={migrating || addEntryOpen}
        title="Move legacy origin values to written_by and state the fields these entries were written without"
      >
        <RotateCw size={13} aria-hidden="true" />
        {migrating ? "Awaiting approval…" : `Migrate ${unmigratedCount} ${unmigratedCount === 1 ? "entry" : "entries"}`}
      </button>
    </div>
  ) : null;

  const statusLine = status ? <p className={`section-copy action-feedback library-status ${status.tone}`} role="status">{status.message}</p> : null;
  const errorLine = error ? <p className="pantheon-error" role="alert">Couldn't read vault entries: {error}</p> : null;

  return (
    <>
      {/* Header-only in residence: the library itself opens as a modal, so the
          resident panel is a single strip rather than a full-height panel
          reporting a count. Research mode drops the strip — the full library is
          already in the column below and would repeat every one of these. */}
      {resident ? null : (
        <section className="dashboard-panel research-panel pantheon-panel is-collapsed surface-chrome library-strip">
          <div className="panel-head">
            <span className="panel-head__icon"><Library size={15} /></span>
            <p className="panel-head__title">Pantheon</p>
            <span className="panel-head__meta">{entryLabel}</span>
            <div className="panel-head__actions">
              <button type="button" className="ghost-action library-action" onClick={() => void handleViewDatabase()}>
                <Layers3 size={13} aria-hidden="true" />
                {busyAction === "view" ? "Refreshing…" : "View Database"}
              </button>
              <button type="button" className="ghost-action library-action" onClick={() => setAddEntryOpen(true)} disabled={busyAction === "view"}>
                <FilePlus2 size={13} aria-hidden="true" />
                Add Entry
              </button>
              <button
                type="button"
                className="ghost-action library-action icon-only-action"
                onClick={() => void refreshPantheon()}
                disabled={loading}
                title="Refresh Pantheon entries from vault"
                aria-label="Refresh Pantheon entries from vault"
              >
                <RotateCw size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
          {migrateNotice}
          {statusLine}
          {errorLine}
        </section>
      )}

      {addEntryOpen ? (
        <AddEntryDialog projects={libraryProjects} onClose={() => setAddEntryOpen(false)} onSaved={handleSaved} />
      ) : null}

      {databaseOpen &&
        inSurface(
          resident,
          <div
            className={resident ? "pantheon-resident-shell" : "pantheon-modal-backdrop"}
            onClick={resident ? undefined : () => setDatabaseRequested(false)}
          >
            <div
              ref={(node) => { databaseDialogRef.current = node; surfaceRef.current = node; }}
              className={resident ? "dashboard-panel pantheon-resident library-surface" : "pantheon-modal library-surface"}
              role={resident ? undefined : "dialog"}
              aria-modal={resident ? undefined : true}
              aria-label={resident ? undefined : "Pantheon Database"}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="pantheon-modal-header library-header">
                <div className="pantheon-modal-title-group library-header__title">
                  <h2 className="pantheon-modal-title">Pantheon</h2>
                  <span className="pantheon-modal-meta">{entryLabel}</span>
                </div>
                <div className="library-segments" role="tablist" aria-label="Research views">
                  {SEGMENTS.map((item, index) => (
                    <button
                      key={item.id}
                      id={`library-tab-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={segment === item.id}
                      aria-controls={`library-view-${item.id}`}
                      aria-label={item.accessible}
                      tabIndex={segment === item.id ? 0 : -1}
                      className={`library-segment ${segment === item.id ? "is-active" : ""}`}
                      onClick={() => selectSegment(item.id)}
                      onKeyDown={(event) => onSegmentKey(event, index)}
                    >
                      {item.label}
                      {item.suffix ? <span className="library-segment__suffix">{item.suffix}</span> : null}
                    </button>
                  ))}
                </div>
                <div className="pantheon-modal-actions library-header__actions">
                  {segment === "library" ? (
                    <label className="pantheon-search-shell library-search">
                      <Search size={14} className="pantheon-search-icon" aria-hidden="true" />
                      <input
                        ref={searchInputRef}
                        value={research.query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search entries…"
                        aria-label="Search the library"
                        className="pantheon-search-input"
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-action library-action icon-only-action"
                    onClick={() => void refreshPantheon()}
                    disabled={loading}
                    title="Refresh Pantheon entries from vault"
                    aria-label="Refresh Pantheon entries from vault"
                  >
                    <RotateCw size={13} aria-hidden="true" />
                  </button>
                  <button type="button" className="ghost-action library-action" onClick={() => setAddEntryOpen(true)} disabled={busyAction === "view"}>
                    <FilePlus2 size={13} aria-hidden="true" />
                    Add Entry
                  </button>
                  {/* Nothing to close in residence — the mode switcher is what
                      leaves. A close button that emptied the centre column
                      would strand Research mode on a blank panel. */}
                  {resident ? null : (
                    <button type="button" className="pantheon-modal-close" onClick={() => setDatabaseRequested(false)} aria-label="Close Pantheon Database" title="Close (Esc)">
                      ×
                    </button>
                  )}
                </div>
              </header>

              {/* The strip carries these outside residence. */}
              {resident ? migrateNotice : null}
              {resident ? statusLine : null}
              {resident ? errorLine : null}

              <div className="library-views">
                <div
                  className="library-view library-view--library"
                  role="tabpanel"
                  id="library-view-library"
                  aria-labelledby="library-tab-library"
                  hidden={segment !== "library"}
                >
                  <LibraryBrowser
                    entries={entries}
                    loading={loading}
                    query={deferredQuery}
                    projects={libraryProjects}
                    active={segment === "library"}
                    openToken={openToken}
                    onOpenEntry={openEntry}
                    onBack={back}
                    backToInspector={research.arrival?.returnTo === "questions" ? "Questions" : research.arrival?.returnTo === "audits" ? "Audits" : null}
                  />
                </div>
                {visited.has("questions") || segment === "questions" ? (
                  <div
                    className="library-view library-view--inspector"
                    role="tabpanel"
                    id="library-view-questions"
                    aria-labelledby="library-tab-questions"
                    hidden={segment !== "questions"}
                    ref={(node) => { inspectorRefs.current.questions = node; }}
                  >
                    <ResearchVerification
                      requestedRunId={inspectionTarget?.runId}
                      inspectionOnly={Boolean(inspectionTarget?.runId)}
                      onReturn={inspectionTarget ? onReturnToCommand : undefined}
                      onOpenEntry={openFromQuestions}
                      hasEntry={hasEntry}
                    />
                  </div>
                ) : null}
                {visited.has("audits") || segment === "audits" ? (
                  <div
                    className="library-view library-view--inspector"
                    role="tabpanel"
                    id="library-view-audits"
                    aria-labelledby="library-tab-audits"
                    hidden={segment !== "audits"}
                    ref={(node) => { inspectorRefs.current.audits = node; }}
                  >
                    <KnowledgeAudit onOpenEntry={openFromAudits} hasEntry={hasEntry} />
                  </div>
                ) : null}
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
