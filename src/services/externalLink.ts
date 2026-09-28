import { invoke } from "@tauri-apps/api/core";
import type { MouseEvent } from "react";
import { isTauriRuntime } from "./launcher";

/**
 * Opens a markdown link outside the app window, the way the library does.
 *
 * Every link is intercepted: letting one navigate would replace the whole app
 * window, with no way back and any open write-gate dialog lost. Only http(s)
 * leaves the app, and on desktop it goes through the Rust `open_external_link`
 * allowlist rather than the webview.
 */
export function openExternalLink(event: MouseEvent<HTMLAnchorElement>, href: string | undefined): void {
  event.preventDefault();
  if (!href || !/^https?:\/\//i.test(href)) return;
  if (isTauriRuntime()) {
    void invoke("open_external_link", { url: href }).catch((error) =>
      console.warn("[Olympus] Could not open the link.", error)
    );
  } else {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
