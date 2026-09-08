import { useLayoutEffect, useRef, useState } from "react";
import { nearConversationBottom } from "../services/commandConsole";

/** Bottom following belongs to the viewport, not message ordering. */
export function useConversationScroll(open: boolean) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const smooth = useRef(false);
  const restore = useRef<{ id: string; offset: number } | null>(null);
  const forceLatest = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);
  function follow(value: boolean) { following.current = value; setIsFollowing(value); }
  function latest(animate = false) {
    restore.current = null;
    forceLatest.current = true;
    follow(true);
    const viewport = viewportRef.current;
    if (viewport) {
      smooth.current = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth.current ? "smooth" : "auto" });
    }
  }
  function preserve() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = viewport.getBoundingClientRect().top;
    const anchor = [...viewport.querySelectorAll<HTMLElement>("[data-message-id]")]
      .find(element => element.getBoundingClientRect().bottom > top);
    restore.current = anchor ? { id: anchor.dataset.messageId!, offset: anchor.getBoundingClientRect().top - top } : null;
    forceLatest.current = false;
    smooth.current = false;
    follow(false);
  }
  function onScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const near = nearConversationBottom(viewport.scrollHeight, viewport.scrollTop, viewport.clientHeight);
    if (smooth.current && !near) return;
    smooth.current = false;
    follow(near);
  }
  function interrupt() { smooth.current = false; forceLatest.current = false; follow(false); }
  // Runs after DOM changes, before paint: prepending restores a real visible anchor.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!open || !viewport) return;
    if (restore.current) {
      const anchor = [...viewport.querySelectorAll<HTMLElement>("[data-message-id]")]
        .find(element => element.dataset.messageId === restore.current!.id);
      if (anchor) viewport.scrollTop += anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - restore.current.offset;
      restore.current = null;
    } else if ((forceLatest.current || following.current) && !smooth.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    forceLatest.current = false;
  });
  useLayoutEffect(() => {
    const viewport = viewportRef.current, content = contentRef.current;
    if (!open || !viewport || !content) return;
    const observer = new ResizeObserver(() => {
      if (following.current && !smooth.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(viewport); observer.observe(content);
    return () => observer.disconnect();
  }, [open]);
  return { viewportRef, contentRef, isFollowing, following, latest, preserve, onScroll, interrupt };
}
