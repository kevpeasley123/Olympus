//! Links out of the app, and the guard that keeps the app window on the app.
//!
//! Research notes are untrusted text. A link in one must open in the system
//! browser; letting it navigate the webview replaces Olympus, including any
//! open write-gate dialog, with a page that has no way back.

use tauri::webview::Webview;
use tauri::{AppHandle, Runtime, Url};
use tauri_plugin_opener::OpenerExt;

/// Opens an http(s) link in the system browser. Any other scheme is refused:
/// the opener hands `file:` or a custom protocol to the shell, which is a
/// launch, not a link.
#[tauri::command]
pub fn open_external_link(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Not a valid link.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only http and https links open from Olympus.".to_string());
    }
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| format!("Could not open the link: {error}"))
}

/// Whether top-level navigation may land on `url`. The app origin differs by
/// platform (`tauri://localhost`, `http(s)://tauri.localhost` on Windows) and
/// by build (the Vite dev server), and nothing else is ever a destination.
pub fn is_app_origin(url: &Url) -> bool {
    if url.as_str() == "about:blank" {
        return true;
    }
    match (url.scheme(), url.host_str(), url.port()) {
        ("tauri", Some("localhost"), None) => true,
        ("http" | "https", Some("tauri.localhost"), None) => true,
        ("http", Some("127.0.0.1"), Some(31420)) => cfg!(debug_assertions),
        _ => false,
    }
}

pub fn navigation_guard<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|_webview: &Webview<R>, url| {
            let allowed = is_app_origin(url);
            if !allowed {
                eprintln!("[Olympus::Navigation] refused top-level navigation to {url}");
            }
            allowed
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allowed(url: &str) -> bool {
        is_app_origin(&Url::parse(url).unwrap())
    }

    #[test]
    fn the_app_origin_is_allowed_on_every_platform() {
        assert!(allowed("tauri://localhost/"));
        assert!(allowed("tauri://localhost/index.html"));
        assert!(allowed("http://tauri.localhost/"));
        assert!(allowed("https://tauri.localhost/assets/index.js"));
        assert!(allowed("about:blank"));
    }

    #[test]
    fn external_and_lookalike_origins_are_refused() {
        assert!(!allowed("https://example.com/"));
        assert!(!allowed("https://tauri.localhost.example.com/"));
        assert!(!allowed("http://tauri.localhost:8080/"));
        assert!(!allowed("http://127.0.0.1:8080/"));
        assert!(!allowed("file:///C:/Windows/System32/"));
        assert!(!allowed("javascript:alert(1)"));
    }

    #[test]
    fn the_dev_server_is_allowed_only_in_debug_builds() {
        assert_eq!(allowed("http://127.0.0.1:31420/"), cfg!(debug_assertions));
    }
}
