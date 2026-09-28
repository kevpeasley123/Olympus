import { invoke } from "@tauri-apps/api/core";
import { memo } from "react";
import type { MouseEvent, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isTauriRuntime, openVaultNote } from "../../../services/launcher";
import { attachmentName, attachmentVaultPath, preprocessObsidianCallouts } from "./libraryModel";

/**
 * Entry bodies are untrusted notes. Markdown here builds syntax-tree nodes the
 * renderer chose, never an HTML string: raw HTML stays text, every link goes
 * through the external-link command, and vault files open only through
 * `open_vault_note`, which resolves inside the vault.
 */

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const WIKILINK = /(!?)\[\[([^\]]+)\]\]/g;

/** `[[target|display]]` and `![[embed]]` as their own nodes, carrying the raw target as data. */
export function remarkWikilinks() {
  return (tree: MarkdownNode) => {
    splitWikilinks(tree);
  };
}

function splitWikilinks(node: MarkdownNode) {
  if (!node.children) return;
  node.children = node.children.flatMap((child): MarkdownNode[] => {
    if (child.type !== "text" || !child.value?.includes("[[")) {
      splitWikilinks(child);
      return [child];
    }

    const pieces: MarkdownNode[] = [];
    let last = 0;
    for (const match of child.value.matchAll(WIKILINK)) {
      const index = match.index ?? 0;
      if (index > last) pieces.push({ type: "text", value: child.value.slice(last, index) });
      const [target, ...rest] = match[2].split("|");
      const display = rest.length ? rest.join("|") : target;
      pieces.push({
        type: match[1] ? "wikiembed" : "wikilink",
        children: [{ type: "text", value: display }],
        data: {
          hName: "span",
          hProperties: match[1] ? { dataWikiembed: target.trim() } : { dataWikilink: target.trim() }
        }
      });
      last = index + match[0].length;
    }
    if (last < child.value.length) pieces.push({ type: "text", value: child.value.slice(last) });
    return pieces;
  });
}

export function openExternalLink(event: MouseEvent<HTMLElement> | null, href: string | undefined | null) {
  // Every link is intercepted: letting one navigate would replace the whole app
  // window, with no way back and any open write-gate dialog lost.
  event?.preventDefault();
  if (!href || !/^https?:\/\//i.test(href)) return;
  if (isTauriRuntime()) {
    void invoke("open_external_link", { url: href }).catch((error) =>
      console.warn("[Olympus] Could not open the link.", error)
    );
  } else {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

export interface EntryLinkTarget {
  id: string;
  title: string;
}

interface EntryMarkdownProps {
  markdown: string;
  resolveWikilink: (target: string) => EntryLinkTarget | null;
  onOpenEntry: (id: string) => void;
}

function readData(node: unknown, key: string): string | null {
  const properties = (node as { properties?: Record<string, unknown> } | undefined)?.properties;
  const value = properties?.[key];
  return typeof value === "string" ? value : null;
}

function AttachmentChip({ target }: { target: string }) {
  const vaultPath = attachmentVaultPath(target);
  const name = attachmentName(target);
  const desktop = isTauriRuntime();
  return (
    <span className="library-attachment" data-attachment={vaultPath ?? undefined}>
      <span className="library-attachment__label">Attachment</span>
      <span aria-hidden="true"> · </span>
      <span className="library-attachment__name">{name}</span>
      {vaultPath && desktop ? (
        <>
          <span aria-hidden="true"> · </span>
          <button
            type="button"
            className="library-inline-action"
            onClick={() => void openVaultNote(vaultPath).catch((error) => console.warn("[Olympus] Could not open the attachment.", error))}
            aria-label={`Open attachment ${name} in Obsidian`}
          >
            Open
          </button>
        </>
      ) : (
        <span className="library-attachment__path" title={vaultPath ? "Opens from the desktop app" : "Not in the research attachments folder; shown as text"}>
          {" "}({vaultPath ?? target})
        </span>
      )}
    </span>
  );
}

/** Memoised on its inputs: re-rendering a long body on every panel update was visible as scroll jank. */
export const EntryMarkdown = memo(function EntryMarkdown({ markdown, resolveWikilink, onOpenEntry }: EntryMarkdownProps) {
  const components: Components = {
    a: ({ children, href }) => (
      <a href={href} rel="noopener noreferrer" onClick={(event) => openExternalLink(event, href)}>
        {children}
      </a>
    ),
    // A remote image is a request the note's author chose, made on open. The
    // CSP refuses it anyway; a link keeps the reference without the fetch.
    img: ({ alt, src }) => (
      <a
        href={typeof src === "string" ? src : undefined}
        rel="noopener noreferrer"
        onClick={(event) => openExternalLink(event, typeof src === "string" ? src : undefined)}
      >
        {alt || "View image"}
      </a>
    ),
    span: ({ node, children, className }) => {
      const link = readData(node, "dataWikilink");
      const embed = readData(node, "dataWikiembed");
      if (embed !== null) {
        const resolved = attachmentVaultPath(embed) ? null : resolveWikilink(embed);
        if (resolved) return <WikiLink entry={resolved} onOpenEntry={onOpenEntry}>{children}</WikiLink>;
        return <AttachmentChip target={embed} />;
      }
      if (link !== null) {
        const resolved = resolveWikilink(link);
        if (resolved) return <WikiLink entry={resolved} onOpenEntry={onOpenEntry}>{children}</WikiLink>;
        return <span className="library-wikilink is-unresolved" title="Not in the library">{children}</span>;
      }
      return <span className={className}>{children}</span>;
    }
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkWikilinks]} components={components}>
      {preprocessObsidianCallouts(markdown)}
    </ReactMarkdown>
  );
});

function WikiLink({ entry, onOpenEntry, children }: { entry: EntryLinkTarget; onOpenEntry: (id: string) => void; children: ReactNode }) {
  return (
    <button type="button" className="library-wikilink" onClick={() => onOpenEntry(entry.id)} title={`Open “${entry.title}” in the library`}>
      {children}
    </button>
  );
}
