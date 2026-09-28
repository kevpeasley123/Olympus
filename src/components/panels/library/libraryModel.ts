import type { PantheonEntry } from "../../../hooks/usePantheon";
import { categoryDescription, categoryLabel, orderedCategories } from "../../../services/pantheonAnalysis";
import { pantheonEntryToResearchRecord } from "../../../services/pantheonRecord";
import { dayLabel, formatWhen, toDate } from "../../../services/time";
import type { ResearchEntryDraft } from "../../../state/viewState";
import type { PantheonCategory, ResearchRecord } from "../../../types";

/**
 * The library's pure logic: entry preparation, search, ordering, link
 * resolution, draft and provenance rules. No React, no IPC — so the rules the
 * review asked for (F3, U3, U5) are pinned by `scripts/test-library.mjs`.
 */

export const RESEARCH_FOLDER = "02 - Research";
export const ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"];

export interface LibraryEntry extends ResearchRecord {
  sourceFile: string;
  /** Empty when the note names no source; never a placeholder. */
  sourceLabel: string;
  sourceUrl: string | null;
  project: string | null;
  /** Frontmatter tags the operator chose, without the automatic ones. */
  userTags: string[];
  automaticTags: string[];
  /** The date the entry was added: `created`, else the file's modified time. */
  addedAt: string;
  addedSort: number;
  /** The frontmatter `source_date` only; null when the note gives none. */
  publishedAt: string | null;
  publishedSort: number;
  fileModifiedAt: string;
  fingerprint: string | null;
  fileFingerprint: string | null;
  markdownBody: string;
  /** Lower-cased title and metadata: the first search tier. */
  metaHaystack: string;
}

export type LibrarySort = "added" | "published" | "title";

export interface LibrarySection {
  title: string;
  description: string;
  category: PantheonCategory;
  entries: LibraryEntry[];
}

// ---- Labels -----------------------------------------------------------------

const TYPE_LABELS: Record<ResearchRecord["sourceType"], string> = {
  article: "Article",
  transcript: "Transcript",
  note: "Note",
  manual: "Procedure",
  guide: "Guide",
  paper: "Paper",
  talk: "Talk"
};

export function typeLabel(sourceType: ResearchRecord["sourceType"]): string {
  return TYPE_LABELS[sourceType] ?? "Article";
}

export const STANCE_LABELS: Record<string, string> = {
  endorsed: "Endorsed",
  provisional: "Provisional",
  disputed: "Disputed",
  unevaluated: "Unevaluated"
};

export function stanceLabel(stance: string | undefined): string {
  return STANCE_LABELS[stance ?? "unevaluated"] ?? "Unevaluated";
}

export function originLabel(origin: string | undefined): string | null {
  if (origin === "collected") return "Collected";
  if (origin === "olympus-found") return "Found by Olympus";
  return null;
}

/**
 * Tags every entry carries because of how it was written, not because the
 * operator chose them. Searching them made "Olympus" match the whole library.
 */
export function isAutomaticTag(tag: string): boolean {
  const value = tag.trim().toLowerCase().replace(/^#/, "");
  return value === "olympus/research" || value === "olympus/pantheon"
    || value.startsWith("research/") || value.startsWith("pantheon/");
}

// ---- Dates --------------------------------------------------------------------

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A frontmatter date such as `2026-09-25` is a calendar day, not UTC midnight. */
export function parseLibraryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_ONLY.exec(value.trim());
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDate(value);
}

/** "Today", "Fri Sep 25", "Thu Sep 25, 2025" — days, for dates that have no time. */
export function formatLibraryDay(value: string | null | undefined, now: Date = new Date()): string | null {
  const date = parseLibraryDate(value);
  return date ? dayLabel(date, now) : null;
}

/** A timestamp with its time, through the shared formatter. */
export function formatLibraryTime(value: string | null | undefined, now: Date = new Date()): string | null {
  const date = parseLibraryDate(value);
  if (!date) return null;
  return DATE_ONLY.test((value ?? "").trim()) ? dayLabel(date, now) : formatWhen(date, { now });
}

// ---- Preparation ----------------------------------------------------------------

const PREPARED = new Map<string, { source: PantheonEntry; entry: LibraryEntry }>();

export function prepareEntries(raw: PantheonEntry[]): LibraryEntry[] {
  return raw.map((entry) => {
    const cached = PREPARED.get(entry.id);
    if (cached && sameSource(cached.source, entry)) return cached.entry;
    const prepared = prepareEntry(entry);
    PREPARED.set(entry.id, { source: entry, entry: prepared });
    return prepared;
  });
}

function sameSource(left: PantheonEntry, right: PantheonEntry): boolean {
  if (left === right) return true;
  return left.fileModifiedAt === right.fileModifiedAt
    && left.body.length === right.body.length
    && left.fingerprint === right.fingerprint
    && left.fileFingerprint === right.fileFingerprint
    && left.title === right.title
    && left.sourceFile === right.sourceFile;
}

export function prepareEntry(entry: PantheonEntry): LibraryEntry {
  const record = pantheonEntryToResearchRecord(entry);
  const sourceLabel = entry.sourceLabel?.trim() === "Local source" ? "" : (entry.sourceLabel ?? "").trim();
  const userTags = entry.tags.filter((tag) => !isAutomaticTag(tag));
  const automaticTags = entry.tags.filter(isAutomaticTag);
  const addedAt = entry.created ?? entry.fileModifiedAt;
  const added = parseLibraryDate(addedAt);
  const published = parseLibraryDate(entry.sourceDate);
  const project = entry.project?.trim() || null;
  const prepared: LibraryEntry = {
    ...record,
    sourceFile: entry.sourceFile,
    sourceLabel,
    sourceUrl: entry.sourceUrl?.trim() || null,
    project,
    userTags,
    automaticTags,
    addedAt,
    addedSort: added ? added.getTime() : Number.NaN,
    publishedAt: entry.sourceDate?.trim() || null,
    publishedSort: published ? published.getTime() : Number.NaN,
    fileModifiedAt: entry.fileModifiedAt,
    fingerprint: entry.fingerprint || null,
    fileFingerprint: entry.fileFingerprint || null,
    markdownBody: record.content.trim(),
    metaHaystack: ""
  };
  prepared.metaHaystack = [
    prepared.title,
    categoryLabel(prepared.category),
    typeLabel(prepared.sourceType),
    prepared.sourceLabel,
    prepared.stance ?? "unevaluated",
    originLabel(prepared.origin) ?? "",
    prepared.origin ?? "",
    prepared.whyKept ?? "",
    project ?? "",
    ...userTags
  ].join("\n").toLowerCase();
  return prepared;
}

// ---- Ordering ----------------------------------------------------------------------

function byTimeDesc(left: number, right: number): number {
  const l = Number.isNaN(left) ? -Infinity : left;
  const r = Number.isNaN(right) ? -Infinity : right;
  return r - l;
}

export function compareEntries(sort: LibrarySort): (left: LibraryEntry, right: LibraryEntry) => number {
  if (sort === "title") return (left, right) => left.title.localeCompare(right.title);
  if (sort === "published") {
    return (left, right) => byTimeDesc(left.publishedSort, right.publishedSort)
      || byTimeDesc(left.addedSort, right.addedSort) || left.title.localeCompare(right.title);
  }
  return (left, right) => byTimeDesc(left.addedSort, right.addedSort)
    || right.fileModifiedAt.localeCompare(left.fileModifiedAt) || left.title.localeCompare(right.title);
}

export function sortEntries(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  return [...entries].sort(compareEntries(sort));
}

export function buildSections(entries: LibraryEntry[], sort: LibrarySort = "added"): LibrarySection[] {
  const buckets = new Map<PantheonCategory, LibraryEntry[]>();
  orderedCategories().forEach((category) => buckets.set(category, []));
  entries.forEach((entry) => buckets.get(entry.category)?.push(entry));
  const compare = compareEntries(sort);
  return orderedCategories().map((category) => ({
    title: categoryLabel(category),
    description: categoryDescription(category),
    category,
    entries: (buckets.get(category) ?? []).sort(compare)
  }));
}

export function latestAddedLabel(entries: LibraryEntry[], now: Date = new Date()): string | null {
  let latest = Number.NaN;
  let value: string | null = null;
  for (const entry of entries) {
    if (!Number.isNaN(entry.addedSort) && (Number.isNaN(latest) || entry.addedSort > latest)) {
      latest = entry.addedSort;
      value = entry.addedAt;
    }
  }
  return value ? formatLibraryDay(value, now) : null;
}

// ---- Search ----------------------------------------------------------------------

export interface SearchResult {
  terms: string[];
  /** Every term in the title or metadata. */
  primary: LibraryEntry[];
  /** Every term somewhere, but only with the body's help. */
  body: LibraryEntry[];
}

const BODY_HAYSTACK = new WeakMap<LibraryEntry, string>();

/** Lower-cased body, built on the first search that needs it and kept per entry version. */
function bodyHaystack(entry: LibraryEntry): string {
  let value = BODY_HAYSTACK.get(entry);
  if (value === undefined) {
    value = entry.markdownBody.toLowerCase();
    BODY_HAYSTACK.set(entry, value);
  }
  return value;
}

export function searchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Two tiers (review F3). Title and metadata matches come first — title,
 * category, type, source, stance, origin, why kept, project and the tags the
 * operator chose. Entries that match only once the body is read follow as
 * "Also mentioned in body". Automatic tags are not searched at all.
 */
export function searchEntries(entries: LibraryEntry[], query: string): SearchResult {
  const terms = searchTerms(query);
  if (terms.length === 0) return { terms, primary: [], body: [] };
  const primary: LibraryEntry[] = [];
  const body: LibraryEntry[] = [];
  for (const entry of entries) {
    const meta = entry.metaHaystack;
    let inMeta = true;
    let everywhere = true;
    for (const term of terms) {
      if (meta.includes(term)) continue;
      inMeta = false;
      if (!bodyHaystack(entry).includes(term)) {
        everywhere = false;
        break;
      }
    }
    if (inMeta) primary.push(entry);
    else if (everywhere) body.push(entry);
  }
  return { terms, primary, body };
}

/** About `radius` characters of body around the first term, for a body-tier row. */
export function bodySnippet(entry: LibraryEntry, terms: string[], radius = 70): string {
  const haystack = bodyHaystack(entry);
  let index = -1;
  let length = 0;
  for (const term of terms) {
    const found = haystack.indexOf(term);
    if (found !== -1 && (index === -1 || found < index)) {
      index = found;
      length = term.length;
    }
  }
  if (index === -1) return "";
  const start = Math.max(0, index - radius);
  const end = Math.min(entry.markdownBody.length, index + length + radius);
  const text = entry.markdownBody.slice(start, end).replace(/[#>*_`|[\]]+/g, " ").replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}${end < entry.markdownBody.length ? "…" : ""}`;
}

// ---- Lookup ------------------------------------------------------------------------

function normalisePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

export function findEntryBySourceFile<T extends { sourceFile: string }>(entries: T[], sourceFile: string): T | null {
  const wanted = normalisePath(sourceFile);
  return entries.find((entry) => normalisePath(entry.sourceFile) === wanted) ?? null;
}

function linkKey(value: string): string {
  return normalisePath(value.split("#")[0].split("^")[0]).replace(/\.md$/, "").trim();
}

/**
 * Resolves an Obsidian `[[target]]` to a library entry by title or by path —
 * vault-relative, research-relative, or the bare file name, as Obsidian does.
 * Unresolved targets return null and render as plain text.
 */
export function buildWikilinkResolver<T extends { title: string; sourceFile: string }>(entries: T[]): (target: string) => T | null {
  const byKey = new Map<string, T>();
  const add = (key: string, entry: T) => { if (key && !byKey.has(key)) byKey.set(key, entry); };
  for (const entry of entries) add(entry.title.trim().toLowerCase(), entry);
  for (const entry of entries) {
    const path = linkKey(entry.sourceFile);
    add(path, entry);
    const prefix = `${RESEARCH_FOLDER.toLowerCase()}/`;
    if (path.startsWith(prefix)) add(path.slice(prefix.length), entry);
    add(path.split("/").pop() ?? "", entry);
  }
  return (target: string) => {
    const key = linkKey(target);
    if (!key) return null;
    return byKey.get(key) ?? byKey.get(target.trim().toLowerCase()) ?? null;
  };
}

/**
 * The vault path of an embedded attachment that may be opened, or null.
 *
 * Only files under `02 - Research/_attachments/` with an allowed extension —
 * where the capture form copies them — and never a path that climbs out.
 * Anything else renders as inert text.
 */
export function attachmentVaultPath(target: string): string | null {
  const value = target.split("|")[0].trim().replace(/\\/g, "/");
  if (!value || /[\u0000-\u001f]/.test(value) || value.startsWith("/") || /^[a-z]:/i.test(value)) return null;
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  const extension = (segments[segments.length - 1].split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension) || !segments[segments.length - 1].includes(".")) return null;
  if (segments[0] === "_attachments" && segments.length === 2) return `${RESEARCH_FOLDER}/${value}`;
  if (segments[0] === RESEARCH_FOLDER && segments[1] === "_attachments" && segments.length === 3) return value;
  return null;
}

export function attachmentName(target: string): string {
  const value = target.split("|")[0].trim().replace(/\\/g, "/");
  return value.split("/").pop() || value;
}

// ---- Add Entry drafts -------------------------------------------------------------

export type EntryDraftFields = Omit<ResearchEntryDraft, "keptAt">;

export const DRAFT_FIELD_LABELS: Record<keyof EntryDraftFields, string> = {
  title: "Title",
  body: "Body",
  sourceType: "Source type",
  sourceUrl: "Source URL",
  sourceDate: "Source date",
  tagsRaw: "Tags",
  stance: "Stance",
  whyKept: "Why kept",
  origin: "Origin",
  project: "Project",
  attachment: "Attachment",
  savedAttachmentPath: "Attachment"
};

export function localDateInput(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The form as it opens. Defaults that assert nothing: saving a source is not
 * agreeing with it, and the capture form is the operator's own hand.
 */
export function blankDraft(today: string = localDateInput()): EntryDraftFields {
  return {
    title: "",
    body: "",
    sourceType: "article",
    sourceUrl: "",
    sourceDate: today,
    tagsRaw: "",
    stance: "unevaluated",
    whyKept: "",
    origin: "collected",
    project: "",
    attachment: null,
    savedAttachmentPath: null
  };
}

/** Every editable field, so closing asks before any typed work is lost (review U3). */
export function changedDraftFields(draft: EntryDraftFields, blank: EntryDraftFields): string[] {
  const changed = new Set<string>();
  (Object.keys(DRAFT_FIELD_LABELS) as (keyof EntryDraftFields)[]).forEach((key) => {
    const left = draft[key];
    const right = blank[key];
    const differs = key === "attachment"
      ? (draft.attachment?.token ?? null) !== (blank.attachment?.token ?? null)
      : typeof left === "string" && typeof right === "string"
        ? left.trim() !== right.trim()
        : left !== right;
    if (differs) changed.add(DRAFT_FIELD_LABELS[key]);
  });
  return Array.from(changed);
}

export function isDraftDirty(draft: EntryDraftFields, blank: EntryDraftFields): boolean {
  return changedDraftFields(draft, blank).length > 0;
}

export interface WritePantheonEntryRequest {
  title: string;
  body: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceDate?: string;
  additionalTags: string[];
  attachments: string[];
  stance?: string;
  whyKept?: string;
  origin?: string;
  project?: string;
}

export function parseTagsInput(raw: string): string[] {
  return raw.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
}

export function draftRequest(draft: EntryDraftFields, attachmentPath: string | null): WritePantheonEntryRequest {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    sourceType: draft.sourceType.trim() || undefined,
    sourceUrl: draft.sourceUrl.trim() || undefined,
    sourceDate: draft.sourceDate.trim() || undefined,
    additionalTags: parseTagsInput(draft.tagsRaw),
    attachments: attachmentPath ? [attachmentPath] : [],
    stance: draft.stance,
    // Omitted rather than sent empty: the backend distinguishes "no purpose
    // stated" from "purpose stated as nothing", and so does the operator.
    whyKept: draft.whyKept.trim() || undefined,
    origin: draft.origin,
    project: draft.project.trim() || undefined
  };
}

/** `save_attachment_to_vault` returns a research-relative path; the operator reads vault paths. */
export function attachmentDisplayPath(path: string): string {
  return path.startsWith("_attachments/") ? `${RESEARCH_FOLDER}/${path}` : path;
}

// ---- Provenance ---------------------------------------------------------------------

export type ProvenanceState = "missing" | "unchanged" | "changed" | "unknown";

/**
 * Compares a stored fingerprint with the entry on disk now (review U5).
 *
 * A reply stores the body's fingerprint; Research Verification stores the
 * whole file's. Either matching means that text is unchanged — SHA-256 does
 * not collide by accident — so both are accepted. No stored or current value
 * means no comparison is claimed.
 */
export function provenanceState(
  entry: { fingerprint?: string | null; fileFingerprint?: string | null } | null,
  storedFingerprint: string | undefined | null
): ProvenanceState {
  if (!entry) return "missing";
  const stored = storedFingerprint?.trim().replace(/^sha256:/i, "").toLowerCase();
  if (!stored) return "unknown";
  const current = [entry.fingerprint, entry.fileFingerprint]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().replace(/^sha256:/i, "").toLowerCase());
  if (current.length === 0) return "unknown";
  return current.includes(stored) ? "unchanged" : "changed";
}

// ---- Excerpt location ----------------------------------------------------------------

/** Markdown syntax that does not survive rendering, removed from both sides of a match. */
const DROPPED = /[*_`#>|~\\]/g;

export function preprocessObsidianCallouts(body: string): string {
  return body.replace(
    /^> \[!(\w+)\](?: (.*))?$/gm,
    (_, type, title) => `> **${(title || String(type)).toUpperCase()}**\n>`
  );
}

/** The excerpt as the rendered article reads it: syntax stripped, whitespace collapsed, lower case. */
export function normaliseMarkdownForMatch(markdown: string): string {
  return preprocessObsidianCallouts(markdown)
    .replace(/!\[\[([^\]]+)\]\]/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*[-:| ]{3,}\s*$/gm, " ")
    .replace(DROPPED, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Rendered text, normalised the same way (without markdown handling). */
export function normaliseRenderedForMatch(text: string): string {
  return text.replace(DROPPED, "").replace(/\s+/g, " ").toLowerCase();
}

const PROBE = 48;
const STEP = 24;

/**
 * Where the excerpt window sits in the rendered text, as [start, end) in the
 * normalised haystack. Probes from both ends so a window that begins or ends
 * mid-syntax still lands; null when the text is no longer there.
 */
export function locateExcerpt(haystack: string, excerpt: string): { start: number; end: number } | null {
  const needle = normaliseMarkdownForMatch(excerpt);
  if (!needle) return null;
  const whole = haystack.indexOf(needle);
  if (whole !== -1) return { start: whole, end: whole + needle.length };
  if (needle.length <= PROBE) return null;

  let start = -1;
  for (let offset = 0; offset + PROBE <= needle.length && offset <= STEP * 20; offset += STEP) {
    const found = haystack.indexOf(needle.slice(offset, offset + PROBE));
    if (found !== -1) {
      start = Math.max(0, found - offset);
      break;
    }
  }
  if (start === -1) return null;

  for (let offset = 0; needle.length - offset - PROBE >= 0 && offset <= STEP * 20; offset += STEP) {
    const probe = needle.slice(needle.length - offset - PROBE, needle.length - offset);
    const found = haystack.indexOf(probe, start);
    if (found !== -1) return { start, end: Math.min(haystack.length, found + PROBE + offset) };
  }
  return { start, end: Math.min(haystack.length, start + needle.length) };
}
