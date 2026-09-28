import { locateExcerpt } from "./libraryModel";

/**
 * Marks the supplied excerpt window in a rendered entry with the CSS Custom
 * Highlight API. Nothing is inserted into the article: the body stays exactly
 * what the markdown renderer produced, and clearing the highlight is one call.
 */

export const EXCERPT_HIGHLIGHT = "library-excerpt";

export interface ExcerptMatch {
  range: Range;
  /** The window covers (nearly) the whole article — the entire entry was supplied. */
  whole: boolean;
}

interface Position {
  node: Text;
  offset: number;
}

const DROPPED = /[*_`#>|~\\]/;

/** Normalised article text, and for each of its characters the DOM position it came from. */
function normalisedText(root: HTMLElement): { text: string; map: Position[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = "";
  const map: Position[] = [];
  let lastWasSpace = true;
  let block: Element | null = null;
  let previous: Text | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data;
    // Block boundaries separate words even when the markdown had only a newline.
    const nodeBlock = blockOf(node, root);
    if (previous && nodeBlock !== block && !lastWasSpace) {
      text += " ";
      lastWasSpace = true;
      map.push({ node: previous, offset: previous.data.length });
    }
    block = nodeBlock;
    previous = node;
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      if (DROPPED.test(char)) continue;
      if (/\s/.test(char)) {
        if (lastWasSpace) continue;
        text += " ";
        lastWasSpace = true;
      } else {
        text += char.toLowerCase();
        lastWasSpace = false;
      }
      map.push({ node, offset: index });
    }
  }
  return { text, map };
}

const BLOCKS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "TD", "TH", "TR", "DIV", "UL", "OL", "TABLE", "SECTION", "ARTICLE", "DT", "DD"]);

function blockOf(node: Node, root: HTMLElement): Element | null {
  for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
    if (BLOCKS.has(element.tagName)) return element;
  }
  return root;
}

export function findExcerpt(root: HTMLElement, excerpt: string): ExcerptMatch | null {
  const { text, map } = normalisedText(root);
  const located = locateExcerpt(text, excerpt);
  if (!located || map.length === 0) return null;
  const start = map[Math.min(located.start, map.length - 1)];
  const last = map[Math.min(Math.max(located.end - 1, located.start), map.length - 1)];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(last.node, Math.min(last.node.data.length, last.offset + 1));
  const covered = located.end - located.start;
  return { range, whole: covered >= text.trim().length * 0.95 };
}

type HighlightRegistry = { set(name: string, value: unknown): void; delete(name: string): void };

function registry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights ?? null;
}

export function paintExcerpt(range: Range | null): boolean {
  const highlights = registry();
  const Highlight = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!highlights || !Highlight) return false;
  if (range) highlights.set(EXCERPT_HIGHLIGHT, new Highlight(range));
  else highlights.delete(EXCERPT_HIGHLIGHT);
  return true;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/** Brings a range into the middle of its scroll container. */
export function scrollRangeIntoView(range: Range, container: HTMLElement | null) {
  const element = range.startContainer.parentElement;
  if (!element) return;
  if (!container) {
    element.scrollIntoView({ block: "center", behavior: scrollBehavior() });
    return;
  }
  const rect = range.getBoundingClientRect();
  const box = container.getBoundingClientRect();
  const target = container.scrollTop + rect.top - box.top - Math.max(48, box.height / 3);
  container.scrollTo({ top: Math.max(0, target), behavior: scrollBehavior() });
}
