import { ChevronDown } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { categoryLabel, orderedCategories } from "../../../services/pantheonAnalysis";
import { useViewSlice } from "../../../state/viewState";
import type { PantheonCategory } from "../../../types";
import type { MutableRefObject } from "react";
import { EntryDetail, MissingSource, type LibraryProject } from "./EntryDetail";
import { scrollBehavior } from "./excerptHighlight";
import {
  bodySnippet,
  buildSections,
  buildWikilinkResolver,
  formatLibraryDay,
  searchEntries,
  sortEntries,
  typeLabel,
  type LibraryEntry,
  type LibrarySection,
  type LibrarySort
} from "./libraryModel";
import { StanceMark } from "./StanceMark";

const SECTION_STORAGE_PREFIX = "pantheon.sectionExpanded.";
const RECENT_COUNT = 20;
const BODY_TIER_PAGE = 100;
/** All entries renders in pages as the reader nears the end; thousands of rows at once blocked input for seconds. */
const ALL_PAGE = 250;
const ROW_ESTIMATE_PX = 48;

type DateMode = "added" | "published";

interface LibraryBrowserProps {
  entries: LibraryEntry[];
  loading: boolean;
  /** Deferred: typing stays responsive while the list catches up. */
  query: string;
  projects: LibraryProject[];
  /** False while another Research segment is showing; the list is kept but hidden. */
  active: boolean;
  openToken: number;
  onOpenEntry: (id: string) => void;
  onBack: () => void;
  backToInspector: string | null;
  /** Filled with a function that records the current scroll; called before the view is hidden. */
  snapshotRef?: MutableRefObject<(() => void) | null>;
}

export function LibraryBrowser({ entries, loading, query, projects, active, openToken, onOpenEntry, onBack, backToInspector, snapshotRef }: LibraryBrowserProps) {
  const [research, setResearch] = useViewSlice("research");
  const { view, detailEntryId, arrival } = research;
  const sort: LibrarySort = research.sort ?? "added";
  const activeCategory = (research.section ?? orderedCategories()[0]) as PantheonCategory;
  const [expandedSections, setExpandedSections] = useState<Record<PantheonCategory, boolean>>(loadExpandedSections);
  const [bodyTierLimit, setBodyTierLimit] = useState(BODY_TIER_PAGE);
  // Enough rows for a restored scroll position to land, then a page more.
  const [allLimit, setAllLimit] = useState(() => ALL_PAGE + Math.ceil(research.listScrollTop / ROW_ESTIMATE_PX));
  const allSentinel = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<PantheonCategory, HTMLElement | null>>>({});
  const suppressSpyUntil = useRef(0);
  const listScroll = useRef(research.listScrollTop);
  const detailScroll = useRef(research.detailScrollTop ?? 0);
  const needsRestore = useRef(true);
  const lastOpenToken = useRef(openToken);
  const previousDetail = useRef<string | null>(detailEntryId);

  const sections = useMemo(() => buildSections(entries, sort === "title" ? "added" : sort), [entries, sort]);
  const resolveWikilink = useMemo(() => buildWikilinkResolver(entries), [entries]);
  const search = useMemo(() => searchEntries(entries, query), [entries, query]);
  const searching = search.terms.length > 0;
  const primarySections = useMemo(() => (searching ? buildSections(search.primary, "added").filter((section) => section.entries.length > 0) : []), [search, searching]);
  const recent = useMemo(() => sortEntries(entries, "added").slice(0, RECENT_COUNT), [entries]);
  const all = useMemo(() => (view === "all" ? sortEntries(entries, sort) : []), [entries, sort, view]);
  const selected = useMemo(() => (detailEntryId ? entries.find((entry) => entry.id === detailEntryId) ?? null : null), [detailEntryId, entries]);
  const missing = !selected && arrival && !detailEntryId ? arrival : null;
  const showingDetail = Boolean(selected || missing);

  const counts = useMemo(() => {
    const result = new Map<PantheonCategory, { primary: number; body: number }>();
    orderedCategories().forEach((category) => result.set(category, { primary: 0, body: 0 }));
    if (searching) {
      search.primary.forEach((entry) => { result.get(entry.category)!.primary += 1; });
      search.body.forEach((entry) => { result.get(entry.category)!.body += 1; });
    }
    return result;
  }, [search, searching]);

  useEffect(() => setBodyTierLimit(BODY_TIER_PAGE), [query]);

  useEffect(() => {
    const sentinel = allSentinel.current;
    if (!sentinel || !active || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((seen) => {
      if (seen.some((entry) => entry.isIntersecting)) setAllLimit((limit) => limit + ALL_PAGE);
    }, { root: scrollRef.current, rootMargin: "0px 0px 800px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // Reading position. The list's scroll is remembered while it is showing,
  // parked in the view store when an entry opens or the panel unmounts, and
  // put back on Back, on a remount after a mode switch, and when this
  // segment is shown again (display:none drops a scroll position).
  const showingDetailRef = useRef(showingDetail);
  showingDetailRef.current = showingDetail;
  const layoutWidth = useRef(0);
  const onScroll = useCallback(() => {
    const container = scrollRef.current;
    // Hiding the segment zeroes the element and can deliver a late scroll
    // event; that is not the operator moving.
    if (!container || container.clientHeight === 0) return;
    layoutWidth.current = container.clientWidth;
    if (showingDetailRef.current) detailScroll.current = container.scrollTop;
    else listScroll.current = container.scrollTop;
  }, []);

  // A new query starts its results at the top; the first render keeps the
  // position restored from the view store.
  const lastQuery = useRef(query);
  useLayoutEffect(() => {
    if (lastQuery.current === query) return;
    lastQuery.current = query;
    listScroll.current = 0;
    if (!showingDetailRef.current && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [query]);

  // Read from the element, not only from scroll events: those arrive a frame
  // later, and a segment switch or mode change can land first. Not when the
  // width has changed since: a list reflowed by the next mode's layout has a
  // scroll position the operator never saw.
  const snapshot = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !container.isConnected || container.clientHeight === 0) return;
    if (layoutWidth.current && container.clientWidth !== layoutWidth.current) return;
    if (showingDetailRef.current) detailScroll.current = container.scrollTop;
    else listScroll.current = container.scrollTop;
  }, []);
  if (snapshotRef) snapshotRef.current = snapshot;

  // A layout cleanup runs while the DOM is still attached.
  useLayoutEffect(() => () => {
    snapshot();
    const list = listScroll.current;
    const detail = detailScroll.current;
    setResearch((current) => ({ ...current, listScrollTop: list, detailScrollTop: detail }));
  }, [setResearch, snapshot]);

  // A category jump scrolls once the grouped view it targets has rendered.
  const pendingJump = useRef<PantheonCategory | null>(null);
  useLayoutEffect(() => {
    const category = pendingJump.current;
    if (!category || !active) return;
    const node = sectionRefs.current[category];
    if (!node) return;
    pendingJump.current = null;
    node.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  });

  useLayoutEffect(() => {
    if (active && scrollRef.current && scrollRef.current.clientHeight > 0) layoutWidth.current = scrollRef.current.clientWidth;
    const before = previousDetail.current;
    const now = selected ? selected.id : missing ? "missing" : null;
    previousDetail.current = now;
    if (!active) {
      needsRestore.current = true;
      return;
    }
    const container = scrollRef.current;
    const opened = lastOpenToken.current !== openToken;
    lastOpenToken.current = openToken;

    if (!container) return;
    if (before === null && now !== null) {
      // Opening from the list: keep where the list was.
      setResearch((current) => ({ ...current, listScrollTop: listScroll.current, detailScrollTop: 0 }));
      detailScroll.current = 0;
      needsRestore.current = false;
      return;
    }
    if (before !== null && now === null) {
      container.scrollTop = listScroll.current;
      needsRestore.current = false;
      // Back lands on the row that was opened — unless focus has already gone
      // somewhere deliberate, such as the search field being typed in.
      const focus = document.activeElement;
      const free = !focus || focus === document.body || container.contains(focus);
      const row = before === "missing" || !free ? null : container.querySelector<HTMLElement>(`[data-entry-id="${cssEscape(before)}"]`);
      row?.focus({ preventScroll: true });
      return;
    }
    if (opened) {
      // EntryDetail placed the view (top, or the highlighted excerpt).
      needsRestore.current = false;
      return;
    }
    if (needsRestore.current && (entries.length > 0 || !loading)) {
      container.scrollTop = now ? detailScroll.current : listScroll.current;
      needsRestore.current = false;
    }
  }, [active, openToken, selected, missing, entries.length, loading, setResearch]);

  // Section spy for the grouped view: the sidebar follows the reader.
  useEffect(() => {
    if (!active || showingDetail || view !== "grouped" || searching) return;
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    let timer: number | null = null;
    const observer = new IntersectionObserver((observed) => {
      const visible = observed.filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible.length === 0 || Date.now() < suppressSpyUntil.current) return;
      const next = visible[0].target.getAttribute("data-category");
      if (!next) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setResearch((current) => (current.section === next ? current : { ...current, section: next })), 80);
    }, { root, rootMargin: "-20% 0px -60% 0px", threshold: 0.05 });
    sections.forEach((section) => {
      const node = sectionRefs.current[section.category];
      if (node) observer.observe(node);
    });
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [active, sections, searching, setResearch, showingDetail, view]);

  const openFromList = useCallback((id: string) => {
    listScroll.current = scrollRef.current?.scrollTop ?? listScroll.current;
    onOpenEntry(id);
  }, [onOpenEntry]);

  function selectView(next: "recent" | "all") {
    setResearch((current) => ({ ...current, view: next, detailEntryId: null, arrival: null, listScrollTop: 0 }));
    listScroll.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  function jumpToCategory(category: PantheonCategory) {
    setResearch((current) => ({ ...current, view: "grouped", section: category, detailEntryId: null, arrival: null }));
    setExpandedSections((current) => {
      if (current[category]) return current;
      persistExpandedState(category, true);
      return { ...current, [category]: true };
    });
    suppressSpyUntil.current = Date.now() + 600;
    pendingJump.current = category;
  }

  function toggleSection(category: PantheonCategory) {
    setExpandedSections((current) => {
      const next = { ...current, [category]: !current[category] };
      persistExpandedState(category, next[category]);
      return next;
    });
  }

  const backLabel = backToInspector
    ?? (searching ? "search results" : view === "recent" ? "Recently added" : view === "all" ? "All entries" : categoryLabel(selected?.category ?? activeCategory));

  return (
    <div className="pantheon-workspace library-workspace">
      <aside className="pantheon-sidebar" aria-label="Library sections">
        <div className="pantheon-sidebar-scroll">
          <div className="pantheon-sidebar-group">
            <p className="pantheon-sidebar-label">Categories</p>
            <div className="pantheon-sidebar-list">
              {sections.map((section) => {
                const count = counts.get(section.category)!;
                const matches = count.primary + count.body;
                const shown = searching ? matches : section.entries.length;
                return (
                  <button
                    key={section.category}
                    type="button"
                    className={`pantheon-sidebar-row ${!searching && view === "grouped" && activeCategory === section.category ? "is-active" : ""} ${searching && matches === 0 ? "is-dimmed" : ""}`}
                    onClick={() => jumpToCategory(section.category)}
                    title={searching ? `${count.primary} in title or metadata, ${count.body} in body only` : undefined}
                    aria-current={!searching && view === "grouped" && activeCategory === section.category ? "true" : undefined}
                  >
                    <span>{section.title}</span>
                    <span className="pantheon-sidebar-count tabular-data">
                      {shown}
                      {searching ? <span className="library-sr-only"> matching</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pantheon-sidebar-divider" />
          <div className="pantheon-sidebar-group">
            <p className="pantheon-sidebar-label">View</p>
            <div className="pantheon-sidebar-list">
              <button type="button" className={`pantheon-sidebar-row ${view === "recent" ? "is-active" : ""}`} aria-current={view === "recent" ? "true" : undefined} onClick={() => selectView("recent")}>
                <span>Recently added</span>
              </button>
              <button type="button" className={`pantheon-sidebar-row ${view === "all" ? "is-active" : ""}`} aria-current={view === "all" ? "true" : undefined} onClick={() => selectView("all")}>
                <span>All entries</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="pantheon-main">
        <div className="pantheon-main-scroll" ref={scrollRef} onScroll={onScroll}>
          {selected ? (
            <EntryDetail
              entry={selected}
              arrival={arrival && arrival.sourceFile ? arrival : null}
              backLabel={backLabel}
              onBack={onBack}
              onOpenEntry={onOpenEntry}
              resolveWikilink={resolveWikilink}
              projects={projects}
              scrollContainer={scrollRef}
              openToken={openToken}
            />
          ) : missing ? (
            <MissingSource arrival={missing} backLabel={backLabel} onBack={onBack} openToken={openToken} />
          ) : searching ? (
            <div className="library-list">
              <p className="library-results-summary" role="status">
                {search.primary.length === 0 && search.body.length === 0
                  ? `No entries mention “${query.trim()}”.`
                  : `${search.primary.length} ${search.primary.length === 1 ? "entry matches" : "entries match"} in titles and details${search.body.length ? ` · ${search.body.length} more in the body only` : ""}`}
              </p>
              {primarySections.map((section) => (
                <SectionBlock
                  key={section.category}
                  section={section}
                  expanded
                  canCollapse={false}
                  onToggle={noop}
                  onOpen={openFromList}
                  sectionRef={(node) => { sectionRefs.current[section.category] = node; }}
                />
              ))}
              {search.body.length > 0 ? (
                <section className="library-body-tier" aria-labelledby="library-body-tier-title">
                  <h4 id="library-body-tier-title" className="library-tier-title">Also mentioned in body ({search.body.length})</h4>
                  <div className="pantheon-flat-list">
                    {search.body.slice(0, bodyTierLimit).map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onOpen={openFromList} showCategory snippet={bodySnippet(entry, search.terms)} />
                    ))}
                  </div>
                  {search.body.length > bodyTierLimit ? (
                    <button type="button" className="ghost-action library-action library-more" onClick={() => setBodyTierLimit(search.body.length)}>
                      Show all {search.body.length}
                    </button>
                  ) : null}
                </section>
              ) : null}
              {search.primary.length === 0 && search.body.length === 0 ? (
                <div className="pantheon-empty-search">
                  <p className="section-copy">
                    Search reads titles, the tags you added, stance, origin, why kept, project and source, then entry bodies.
                    Automatic tags such as <code>olympus/research</code> are not searched.
                  </p>
                </div>
              ) : null}
            </div>
          ) : view === "recent" ? (
            <div className="library-list pantheon-flat-view">
              <div className="pantheon-mode-header">
                <p className="projects-title">Recently added</p>
                <span className="section-copy">{recent.length} most recently added</span>
              </div>
              <div className="pantheon-flat-list">
                {recent.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={openFromList} showCategory />)}
              </div>
            </div>
          ) : view === "all" ? (
            <div className="library-list pantheon-flat-view">
              <div className="pantheon-mode-header">
                <div>
                  <p className="projects-title">All entries</p>
                  <span className="section-copy">{all.length} entries</span>
                </div>
                <label className="library-sort">
                  <span>Order</span>
                  <select
                    className="pantheon-sort-select"
                    value={sort}
                    onChange={(event) => setResearch((current) => ({ ...current, sort: event.target.value as LibrarySort }))}
                  >
                    <option value="added">Recently added</option>
                    <option value="published">Publication date</option>
                    <option value="title">Title A–Z</option>
                  </select>
                </label>
              </div>
              <div className="pantheon-flat-list">
                {all.slice(0, allLimit).map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={openFromList} showCategory dateMode={sort === "published" ? "published" : "added"} />)}
              </div>
              {all.length > allLimit ? (
                <div ref={allSentinel} className="library-more-row">
                  <span className="section-copy">Showing {allLimit} of {all.length}</span>
                  <button type="button" className="ghost-action library-action" onClick={() => setAllLimit(all.length)}>Show all</button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="library-list pantheon-sections">
              {loading && entries.length === 0 ? <p className="section-copy">Reading the library…</p> : null}
              {sections.map((section) => (
                <SectionBlock
                  key={section.category}
                  section={section}
                  expanded={expandedSections[section.category]}
                  canCollapse
                  onToggle={() => toggleSection(section.category)}
                  onOpen={openFromList}
                  sectionRef={(node) => { sectionRefs.current[section.category] = node; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function noop() {}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function SectionBlock({ section, expanded, canCollapse, onToggle, onOpen, sectionRef }: {
  section: LibrarySection;
  expanded: boolean;
  canCollapse: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  sectionRef: (node: HTMLElement | null) => void;
}) {
  const count = `${section.entries.length} ${section.entries.length === 1 ? "entry" : "entries"}`;
  const listId = `library-section-${section.category}`;
  return (
    <section className="pantheon-section" aria-label={section.title}>
      <div ref={sectionRef} data-category={section.category} className="pantheon-section-header">
        <button
          type="button"
          className="pantheon-section-toggle"
          onClick={canCollapse ? onToggle : undefined}
          aria-expanded={canCollapse ? expanded : undefined}
          aria-controls={canCollapse ? listId : undefined}
          disabled={!canCollapse}
        >
          {canCollapse ? (
            <span className={`pantheon-section-chevron ${expanded ? "is-expanded" : ""}`} aria-hidden="true">
              <ChevronDown size={12} />
            </span>
          ) : <span aria-hidden="true" />}
          <span className="pantheon-section-heading">
            <span className="projects-title">{section.title}</span>
            <span className="pantheon-section-count-inline">{count}</span>
          </span>
          <span className="pantheon-section-description">{section.description}</span>
        </button>
      </div>
      {expanded ? (
        <div className="pantheon-entry-list" id={listId}>
          {section.entries.length > 0 ? (
            section.entries.map((entry) => <EntryRow key={entry.id} entry={entry} onOpen={onOpen} />)
          ) : (
            <div className="pantheon-empty-section"><span>No entries yet.</span></div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Memoised: a library of thousands re-renders only the rows whose entry changed. */
const EntryRow = memo(function EntryRow({ entry, onOpen, showCategory = false, snippet, dateMode = "added" }: {
  entry: LibraryEntry;
  onOpen: (id: string) => void;
  showCategory?: boolean;
  snippet?: string;
  dateMode?: DateMode;
}) {
  const dateValue = dateMode === "published" ? entry.publishedAt : entry.addedAt;
  const date = formatLibraryDay(dateValue);
  return (
    <button type="button" className="pantheon-entry-row library-row" data-entry-id={entry.id} onClick={() => onOpen(entry.id)}>
      {showCategory ? <span className="pantheon-inline-category">{categoryLabel(entry.category)}</span> : null}
      <span className="pantheon-entry-row-top">
        <strong>{entry.title}</strong>
        <span className="pantheon-entry-row-meta">
          <span className="tabular-data">{new Intl.NumberFormat().format(entry.wordCount)} words</span>
          {date ? (
            <span className="tabular-data pantheon-entry-date">
              {dateMode === "published" ? "Published" : "Added"} {date}
            </span>
          ) : dateMode === "published" ? <span className="pantheon-entry-date">No publication date</span> : null}
        </span>
      </span>
      <span className="pantheon-entry-row-bottom">
        <StanceMark stance={entry.stance} compact />
        <span className={`pantheon-type-tag pantheon-type-${entry.sourceType}`}>{typeLabel(entry.sourceType)}</span>
        {entry.sourceLabel ? <span className="pantheon-entry-source">{entry.sourceLabel}</span> : null}
      </span>
      {snippet ? <span className="library-row__snippet">{snippet}</span> : null}
    </button>
  );
});

function loadExpandedSections(): Record<PantheonCategory, boolean> {
  const result = {} as Record<PantheonCategory, boolean>;
  orderedCategories().forEach((category, index) => {
    const stored = readStoredFlag(`${SECTION_STORAGE_PREFIX}${category}`);
    result[category] = stored === "true" || stored === "false" ? stored === "true" : index < 2;
  });
  return result;
}

// Section state is a convenience. Storage that is full, disabled, or denied
// must not take the library down with it.
function readStoredFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistExpandedState(category: PantheonCategory, expanded: boolean) {
  try {
    window.localStorage.setItem(`${SECTION_STORAGE_PREFIX}${category}`, String(expanded));
  } catch {
    // The toggle still applies for this session.
  }
}
