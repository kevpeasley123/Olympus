import { ArrowLeft, ExternalLink, FolderOpen } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { isTauriRuntime, openVaultNote } from "../../../services/launcher";
import { openProject } from "../../../services/navigation";
import { categoryLabel } from "../../../services/pantheonAnalysis";
import type { ResearchArrival } from "../../../state/viewState";
import { EntryMarkdown, openExternalLink } from "./entryMarkdown";
import { findExcerpt, paintExcerpt, scrollRangeIntoView } from "./excerptHighlight";
import {
  formatLibraryDay,
  formatLibraryTime,
  originLabel,
  provenanceState,
  typeLabel,
  type LibraryEntry,
  type ProvenanceState
} from "./libraryModel";
import { StanceMark } from "./StanceMark";

export interface LibraryProject {
  id: string;
  name: string;
  notePath: string | null;
}

const CONTEXT_NOUN: Record<ResearchArrival["context"], string> = {
  reply: "this reply",
  verification: "this verification run",
  audit: "this audit"
};

const CONTEXT_ORIGIN: Record<ResearchArrival["context"], string> = {
  reply: "Opened from a chat reply",
  verification: "Opened from a saved verification run",
  audit: "Opened from a knowledge audit"
};

function stateSentence(state: ProvenanceState, context: ResearchArrival["context"]): string {
  const noun = CONTEXT_NOUN[context];
  if (state === "unchanged") return `Unchanged since ${noun}. The file's text matches what was supplied.`;
  if (state === "changed") return `Changed since ${noun}. The file on disk differs from the text supplied then; that text is kept below, apart from the current file.`;
  return "No fingerprint was recorded, so a change cannot be detected.";
}

function stateLabel(state: ProvenanceState, context: ResearchArrival["context"]): string {
  const noun = CONTEXT_NOUN[context];
  if (state === "unchanged") return `Unchanged since ${noun}`;
  if (state === "changed") return `Changed since ${noun}`;
  if (state === "missing") return "Source no longer in library";
  return "Change not checked";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function matchProject(value: string | null, projects: LibraryProject[]): LibraryProject | null {
  if (!value) return null;
  const key = value.trim().toLowerCase().replace(/\\/g, "/").replace(/\.md$/, "");
  return projects.find((project) => {
    const note = project.notePath?.toLowerCase().replace(/\\/g, "/").replace(/\.md$/, "") ?? "";
    return project.name.toLowerCase() === key || (note && (note === key || note.split("/").pop() === key.split("/").pop()));
  }) ?? null;
}

type HighlightStatus = "none" | "highlighted" | "whole" | "absent";

interface EntryDetailProps {
  entry: LibraryEntry;
  arrival: ResearchArrival | null;
  backLabel: string;
  onBack: () => void;
  onOpenEntry: (id: string) => void;
  resolveWikilink: (target: string) => LibraryEntry | null;
  projects: LibraryProject[];
  scrollContainer: RefObject<HTMLDivElement | null>;
  /** Changes on each deliberate open; a remount after a mode switch keeps it and does not steal focus. */
  openToken: number;
}

export function EntryDetail({ entry, arrival, backLabel, onBack, onOpenEntry, resolveWikilink, projects, scrollContainer, openToken }: EntryDetailProps) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const handledToken = useRef<number | null>(null);
  const [highlight, setHighlight] = useState<HighlightStatus>("none");
  const provenance = arrival ? provenanceState(entry, arrival.fingerprint) : null;
  const provenanceRef = useRef(provenance);
  provenanceRef.current = provenance;
  const project = useMemo(() => matchProject(entry.project, projects), [entry.project, projects]);
  const desktop = isTauriRuntime();

  // Highlight first, then the one-time open behaviour: title focused, the
  // detail at its top, or at the excerpt when one was supplied.
  useLayoutEffect(() => {
    rangeRef.current = null;
    let status: HighlightStatus = "none";
    if (arrival?.excerpt && bodyRef.current) {
      const match = findExcerpt(bodyRef.current, arrival.excerpt);
      if (!match) status = "absent";
      else if (match.whole) status = "whole";
      else {
        status = "highlighted";
        rangeRef.current = match.range;
      }
    }
    paintExcerpt(rangeRef.current);
    setHighlight(status);

    if (handledToken.current !== openToken && openToken > 0) {
      handledToken.current = openToken;
      titleRef.current?.focus({ preventScroll: true });
      const container = scrollContainer.current;
      if (container) container.scrollTop = 0;
      // A changed source leads with that fact; the highlight is one click away.
      if (rangeRef.current && provenanceRef.current !== "changed") scrollRangeIntoView(rangeRef.current, container);
    } else if (handledToken.current === null) {
      handledToken.current = openToken;
    }
  }, [entry.id, entry.markdownBody, arrival?.excerpt, openToken, scrollContainer]);

  useLayoutEffect(() => () => { paintExcerpt(null); }, []);

  const showExcerpt = useCallback(() => {
    if (rangeRef.current) scrollRangeIntoView(rangeRef.current, scrollContainer.current, true);
  }, [scrollContainer]);

  const added = formatLibraryDay(entry.addedAt);
  const published = formatLibraryDay(entry.publishedAt);
  const modified = formatLibraryTime(entry.fileModifiedAt);
  const origin = originLabel(entry.origin);

  return (
    <article className="library-detail" aria-labelledby={`library-detail-title-${entry.id}`}>
      <button type="button" className="library-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" />
        Back to {backLabel}
      </button>

      <header className="library-detail__header">
        <p className="library-detail__kicker">
          {typeLabel(entry.sourceType)} · {categoryLabel(entry.category)}
        </p>
        <h3 id={`library-detail-title-${entry.id}`} ref={titleRef} tabIndex={-1}>{entry.title}</h3>
        {/* Stated, not implied. An entry with no declared purpose should look
            different from one the operator justified — otherwise the library
            reads as uniformly endorsed. */}
        <p className="library-detail__judgement">
          <StanceMark stance={entry.stance} />
          {origin ? <span className="library-origin">{origin}</span> : null}
          <span className={`library-why-kept ${entry.whyKept ? "" : "is-absent"}`}>
            {entry.whyKept ?? "No stated purpose"}
          </span>
        </p>
      </header>

      {arrival && provenance ? (
        <section className={`library-provenance is-${provenance}`} aria-label="Where this was opened from">
          <p className="library-provenance__origin">{CONTEXT_ORIGIN[arrival.context]}</p>
          <p className="library-provenance__state">
            <strong>{stateLabel(provenance, arrival.context)}.</strong>{" "}
            {stateSentence(provenance, arrival.context).split(". ").slice(1).join(". ")}
          </p>
          {arrival.excerpt ? (
            <>
              <p className="library-provenance__highlight">
                {highlight === "highlighted" ? (
                  <>
                    The supplied excerpt is highlighted in the current file.{" "}
                    <button type="button" className="library-inline-action" onClick={showExcerpt}>Show excerpt</button>
                  </>
                ) : highlight === "whole" ? "The whole entry was supplied."
                  : highlight === "absent" ? "The supplied excerpt no longer appears in the current file."
                  : null}
              </p>
              <details className="library-historical" open={provenance === "changed" || highlight === "absent"}>
                <summary>Text supplied to {CONTEXT_NOUN[arrival.context]} (historical)</summary>
                <blockquote>{arrival.excerpt}</blockquote>
              </details>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="library-detail__grid">
        <aside className="library-rail" aria-label="Entry details">
          <dl>
            {entry.sourceLabel ? <Fact term="Source">{entry.sourceLabel}</Fact> : null}
            {entry.sourceUrl ? (
              <Fact term="Link">
                {/^https?:\/\//i.test(entry.sourceUrl) ? (
                  <a href={entry.sourceUrl} rel="noopener noreferrer" title={entry.sourceUrl} onClick={(event) => openExternalLink(event, entry.sourceUrl)}>
                    {hostOf(entry.sourceUrl)} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="library-rail__muted" title="Not an http(s) link; shown as text">{entry.sourceUrl}</span>
                )}
              </Fact>
            ) : null}
            {published ? <Fact term="Published">{published}</Fact> : null}
            {added ? <Fact term="Added">{added}</Fact> : null}
            {modified ? <Fact term="Modified">{modified}</Fact> : null}
            <Fact term="Length">{new Intl.NumberFormat().format(entry.wordCount)} words · {entry.estReadMinutes} min</Fact>
            {entry.project ? (
              <Fact term="Project" wide>
                {entry.project}
                {project ? (
                  <> · <button type="button" className="library-inline-action" onClick={() => openProject(project.id)}>Open project</button></>
                ) : null}
              </Fact>
            ) : null}
            <Fact term="Tags" wide>
              {entry.userTags.length ? (
                <span className="library-tags">{entry.userTags.map((tag) => <span key={tag} className="library-tag">{tag}</span>)}</span>
              ) : <span className="library-rail__muted">None added</span>}
              {entry.automaticTags.length ? (
                <span className="library-rail__muted library-rail__auto" title="Added automatically; not searched">
                  Automatic: {entry.automaticTags.join(", ")}
                </span>
              ) : null}
            </Fact>
            <Fact term="Vault path" wide><span className="library-rail__path">{entry.sourceFile}</span></Fact>
          </dl>
          <button
            type="button"
            className="ghost-action library-action"
            disabled={!desktop}
            title={desktop ? "Open this note in Obsidian" : "Opens from the desktop app"}
            onClick={() => void openVaultNote(entry.sourceFile).catch((error) => console.warn("[Olympus] Could not open the note.", error))}
          >
            <FolderOpen size={13} aria-hidden="true" />
            Open in Obsidian
          </button>
        </aside>

        <div className="pantheon-entry-body library-reading" ref={bodyRef}>
          <EntryMarkdown markdown={entry.markdownBody} resolveWikilink={resolveWikilink} onOpenEntry={onOpenEntry} />
        </div>
      </div>
    </article>
  );
}

function Fact({ term, wide = false, children }: { term: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`library-fact${wide ? " is-wide" : ""}`}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** The destination for a source that is no longer in the library (review U5). */
export function MissingSource({ arrival, backLabel, onBack, openToken }: { arrival: ResearchArrival; backLabel: string; onBack: () => void; openToken: number }) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    if (openToken > 0) titleRef.current?.focus({ preventScroll: true });
  }, [openToken]);
  return (
    <article className="library-detail library-detail--missing" aria-labelledby="library-missing-title">
      <button type="button" className="library-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" />
        Back to {backLabel}
      </button>
      <header className="library-detail__header">
        <p className="library-detail__kicker">{CONTEXT_ORIGIN[arrival.context]}</p>
        <h3 id="library-missing-title" ref={titleRef} tabIndex={-1}>{arrival.title || arrival.sourceFile}</h3>
      </header>
      <section className="library-provenance is-missing" aria-label="Where this was opened from">
        <p className="library-provenance__state">
          <strong>Source no longer in library.</strong> Nothing at <code>{arrival.sourceFile}</code> is in the research library now. It may have been moved, renamed, untagged or deleted.
        </p>
        {arrival.excerpt ? (
          <details className="library-historical" open>
            <summary>Text supplied to {CONTEXT_NOUN[arrival.context]} (historical)</summary>
            <blockquote>{arrival.excerpt}</blockquote>
          </details>
        ) : null}
      </section>
    </article>
  );
}
