import type { PantheonEntry } from "../../../hooks/usePantheon";
import { mapPantheonSourceType } from "../../../services/pantheonRecord";
import {
  attachmentVaultPath,
  blankDraft,
  buildWikilinkResolver,
  changedDraftFields,
  DRAFT_FIELD_LABELS,
  draftRequest,
  isAutomaticTag,
  isDraftDirty,
  locateExcerpt,
  normaliseRenderedForMatch,
  prepareEntries,
  prepareEntry,
  provenanceState,
  searchEntries,
  sortEntries,
  typeLabel,
  type EntryDraftFields
} from "./libraryModel";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function raw(overrides: Partial<PantheonEntry> = {}): PantheonEntry {
  const id = overrides.id ?? overrides.sourceFile ?? "02 - Research/Entry.md";
  return {
    id,
    title: "Entry",
    sourceFile: id,
    entryType: "research",
    sourceType: "article",
    created: "2026-09-01",
    origin: "collected",
    stance: "unevaluated",
    sourceLabel: "",
    tags: ["olympus/research", "research/article"],
    wordCount: 10,
    fileModifiedAt: "2026-09-01T10:00:00Z",
    bodyPreview: "",
    body: "A body.",
    ...overrides
  };
}

export function runLibraryModelHarness() {
  const checks: string[] = [];
  const check = (name: string, fn: () => void) => { fn(); checks.push(name); };

  const entries = prepareEntries([
    raw({ id: "02 - Research/Agent loops.md", title: "Agent loops", tags: ["olympus/research", "research/article", "orchestration"], body: "Loops discover work." }),
    raw({ id: "02 - Research/Gardening.md", title: "Gardening", body: "An agent waters the bonsai. Olympus is not mentioned in the title." }),
    raw({ id: "02 - Research/Disputed.md", title: "Scaling claims", stance: "disputed", whyKept: "Counter-evidence for the pair design", project: "Project Olympus" }),
    raw({ id: "02 - Research/Found.md", title: "Surfaced source", origin: "olympus-found", created: "2026-09-20", sourceDate: "2024-01-01", tags: ["olympus/research", "pantheon/agent-systems"] }),
    raw({ id: "02 - Research/Old.md", title: "Old but recent publication", created: undefined, fileModifiedAt: "2026-08-01T09:00:00Z", sourceDate: "2026-09-27" })
  ]);

  check("automatic tags are recognised and never searched", () => {
    assert(isAutomaticTag("olympus/research") && isAutomaticTag("research/guide") && isAutomaticTag("pantheon/agent-systems") && isAutomaticTag("#olympus/pantheon"), "automatic tag missed");
    assert(!isAutomaticTag("orchestration") && !isAutomaticTag("agent-systems"), "a chosen tag read as automatic");
    for (const query of ["pantheon", "olympus/research", "research/article"]) {
      const found = searchEntries(entries, query);
      assert(found.primary.length === 0 && found.body.length === 0, `"${query}" matched ${found.primary.map((e) => e.title).join(", ")} through automatic tags`);
    }
    const olympus = searchEntries(entries, "olympus");
    assert(olympus.primary.map((e) => e.title).join("|") === "Scaling claims|Surfaced source", `"olympus" tier one: ${olympus.primary.map((e) => e.title).join("|")}`);
    assert(olympus.body.map((e) => e.title).join("|") === "Gardening", "body mention of Olympus not in the second tier");
  });

  check("search tiers: title and metadata first, body-only second", () => {
    const loops = searchEntries(entries, "loops");
    assert(loops.primary.map((e) => e.title).join("|") === "Agent loops", "title match not in tier one");
    assert(loops.body.length === 0, "a tier-one entry repeated in the body tier");
    const bonsai = searchEntries(entries, "bonsai");
    assert(bonsai.primary.length === 0 && bonsai.body.map((e) => e.title).join("|") === "Gardening", "body-only match not in tier two");
    const mixed = searchEntries(entries, "gardening bonsai");
    assert(mixed.primary.length === 0 && mixed.body.map((e) => e.title).join("|") === "Gardening", "a match that needs the body belongs to tier two");
    assert(searchEntries(entries, "gardening tulips").body.length === 0, "every term must match");
  });

  check("search reads stance, origin, why kept, project and chosen tags", () => {
    assert(searchEntries(entries, "disputed").primary[0]?.title === "Scaling claims", "stance not searched");
    assert(searchEntries(entries, "counter-evidence").primary[0]?.title === "Scaling claims", "why kept not searched");
    assert(searchEntries(entries, "found by olympus").primary[0]?.title === "Surfaced source", "origin label not searched");
    assert(searchEntries(entries, "project olympus").primary[0]?.title === "Scaling claims", "project not searched");
    assert(searchEntries(entries, "orchestration").primary[0]?.title === "Agent loops", "chosen tag not searched");
    assert(searchEntries(entries, "   ").terms.length === 0, "blank query searched");
  });

  check("recently added sorts by created, then file date; publication is separate", () => {
    const added = sortEntries(entries, "added").map((e) => e.title);
    assert(added[0] === "Surfaced source", `added order starts ${added[0]}`);
    assert(added[added.length - 1] === "Old but recent publication", "file date not used when created is absent");
    const published = sortEntries(entries, "published").map((e) => e.title);
    assert(published[0] === "Old but recent publication", `publication order starts ${published[0]}`);
  });

  check("source types keep their identity end to end", () => {
    for (const [input, label] of [["guide", "Guide"], ["paper", "Paper"], ["talk", "Talk"], ["transcript", "Transcript"], ["article", "Article"], ["procedure", "Procedure"], ["Guide", "Guide"]]) {
      const type = mapPantheonSourceType(input);
      assert(typeLabel(type) === label, `${input} became ${typeLabel(type)}`);
      const entry = prepareEntry(raw({ id: `02 - Research/${input}.md`, sourceType: input }));
      assert(typeLabel(entry.sourceType) === label, `${input} entry shows ${typeLabel(entry.sourceType)}`);
    }
    assert(searchEntries(prepareEntries([raw({ id: "02 - Research/p.md", sourceType: "paper" })]), "paper").primary.length === 1, "type label not searchable");
  });

  check("an unnamed source has no placeholder label", () => {
    assert(prepareEntry(raw({ id: "02 - Research/a.md", sourceLabel: "Local source" })).sourceLabel === "", "legacy placeholder shown");
    assert(prepareEntry(raw({ id: "02 - Research/b.md", sourceLabel: "Stratechery" })).sourceLabel === "Stratechery", "named source lost");
  });

  check("Add Entry dirty detection covers every editable field", () => {
    const blank = blankDraft("2026-09-28");
    assert(!isDraftDirty(blank, blank), "blank form reads as dirty");
    assert(!isDraftDirty({ ...blank, title: "   " }, blank), "whitespace alone reads as work");
    const changes: [keyof EntryDraftFields, EntryDraftFields[keyof EntryDraftFields]][] = [
      ["title", "T"], ["body", "B"], ["sourceType", "guide"], ["sourceUrl", "https://x"], ["sourceDate", "2026-01-01"],
      ["tagsRaw", "a"], ["stance", "endorsed"], ["whyKept", "w"], ["origin", "olympus-found"], ["project", "Project Olympus"],
      ["attachment", { token: "t", originalFilename: "a.pdf", extension: "pdf" }], ["savedAttachmentPath", "_attachments/a.pdf"]
    ];
    assert(changes.length === Object.keys(DRAFT_FIELD_LABELS).length, "a draft field has no dirty check");
    for (const [key, value] of changes) {
      const draft = { ...blank, [key]: value } as EntryDraftFields;
      assert(isDraftDirty(draft, blank), `${key} alone is not detected`);
      assert(changedDraftFields(draft, blank).includes(DRAFT_FIELD_LABELS[key]), `${key} not named in the prompt`);
    }
  });

  check("a retry reuses the attachment already written", () => {
    const draft = { ...blankDraft("2026-09-28"), title: "T", body: "B", project: "Project Olympus", attachment: { token: "spent", originalFilename: "a.pdf", extension: "pdf" }, savedAttachmentPath: "_attachments/a.pdf" };
    const request = draftRequest(draft, draft.savedAttachmentPath);
    assert(request.attachments.length === 1 && request.attachments[0] === "_attachments/a.pdf", "saved attachment path not reused");
    assert(request.project === "Project Olympus", "project not sent");
    assert(draftRequest({ ...draft, whyKept: "  " }, null).whyKept === undefined, "blank why-kept sent as a stated purpose");
  });

  check("fingerprint comparison: unchanged, changed, missing, unknown", () => {
    const current = { fingerprint: "aaa", fileFingerprint: "fff" };
    assert(provenanceState(current, "aaa") === "unchanged", "same body fingerprint not unchanged");
    assert(provenanceState(current, "sha256:AAA") === "unchanged", "prefixed or cased fingerprint not normalised");
    assert(provenanceState(current, "fff") === "unchanged", "verification's file fingerprint not accepted");
    assert(provenanceState(current, "bbb") === "changed", "different fingerprint not changed");
    assert(provenanceState(null, "aaa") === "missing", "absent entry not missing");
    assert(provenanceState(current, undefined) === "unknown", "no stored fingerprint claimed a comparison");
    assert(provenanceState({ fingerprint: null, fileFingerprint: null }, "aaa") === "unknown", "no current fingerprint claimed a comparison");
  });

  check("wikilinks resolve by title or path, else stay text", () => {
    const resolve = buildWikilinkResolver(entries);
    assert(resolve("agent loops")?.title === "Agent loops", "title, case-insensitive");
    assert(resolve("02 - Research/Gardening.md")?.title === "Gardening", "vault path with extension");
    assert(resolve("02 - Research/Gardening")?.title === "Gardening", "vault path without extension");
    assert(resolve("Gardening")?.title === "Gardening", "bare file name");
    assert(resolve("Agent loops#Section")?.title === "Agent loops", "heading suffix");
    assert(resolve("02 - Research\\Found")?.title === "Surfaced source", "backslash path");
    assert(resolve("Nowhere") === null && resolve("") === null, "unresolved target returned an entry");
  });

  check("attachments open only inside the research attachments folder", () => {
    assert(attachmentVaultPath("_attachments/paper.pdf") === "02 - Research/_attachments/paper.pdf", "research-relative attachment");
    assert(attachmentVaultPath("02 - Research/_attachments/paper.pdf") === "02 - Research/_attachments/paper.pdf", "vault-relative attachment");
    assert(attachmentVaultPath("_attachments/paper.pdf|300") === "02 - Research/_attachments/paper.pdf", "sized embed");
    for (const bad of ["_attachments/../../09 - System/Profile Observations.md", "../x.pdf", "/etc/passwd.txt", "C:/x.pdf", "_attachments/run.exe", "_attachments/", "04 - Decisions/Decision Log.md", "_attachments/sub/x.pdf", "_attachments/./x.pdf"]) {
      assert(attachmentVaultPath(bad) === null, `${bad} was allowed`);
    }
  });

  check("the supplied excerpt is located in rendered text, or reported absent", () => {
    const rendered = normaliseRenderedForMatch("Summary\nAgent orchestration works best when the graph owns ordering and the loop owns discovery. This note collects arguments.");
    const exact = locateExcerpt(rendered, "Agent orchestration works best when the **graph owns ordering** and the loop owns discovery.");
    assert(exact && rendered.slice(exact.start, exact.end).startsWith("agent orchestration"), "excerpt with emphasis not located");
    const windowed = locateExcerpt(rendered, "## Summary\n\nAgent orchestration works best when the graph owns ordering and the loop owns discovery. This note collects arguments.");
    assert(windowed !== null, "excerpt with a heading not located");
    assert(locateExcerpt(rendered, "Nothing like this sentence appears anywhere in the rendered entry text at all.") === null, "absent excerpt located");
    const linked = normaliseRenderedForMatch("See also Agent Engineering and verification patterns and the source.");
    assert(locateExcerpt(linked, "See also [[Agent Engineering]] and [[02 - Research/Verification Patterns|verification patterns]] and [the source](https://x).") !== null, "wikilinks and links not normalised");
  });

  return { passed: checks.length, checks };
}
