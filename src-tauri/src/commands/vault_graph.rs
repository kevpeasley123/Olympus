//! The vault's link structure, as a graph rooted at the declared projects.
//!
//! Radius in the instrument means distance from active work, so this returns a
//! hop distance per note rather than positions — layout is the frontend's job
//! and must stay deterministic. Nothing here is force-directed: the same vault
//! has to produce the same picture tomorrow.

use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use super::get_vault_path;
use super::project_notes::load_project_notes;

/// Drawn-node ceiling. Well above the current vault, deliberately — it should
/// exist before it is needed rather than be invented during an incident.
const NODE_CAP: usize = 120;

/// Outbound link targets per file, held while the file's mtime is unchanged.
/// The same pattern the Pantheon scan uses; a scan that finds no edits reads no
/// file contents at all.
static LINK_CACHE: Lazy<Mutex<HashMap<PathBuf, (SystemTime, Vec<String>)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    /// Vault-relative path, forward-slashed. Stable, so layout ordering is too.
    pub id: String,
    pub title: String,
    pub folder: String,
    /// Hops from the nearest declared project. `None` means unreachable — an
    /// orphan, which is the rim and the point of the whole view.
    pub hop: Option<u32>,
    pub is_project: bool,
    pub degree: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    /// Declared project notes — the graph's anchors.
    pub project_count: u32,
    /// Anchors that actually have an edge.
    ///
    /// This, not `project_count`, is what the render gate reads. Counting
    /// anchors alone let a newly written project note — which links to nothing
    /// yet — switch the graph on as a bare dot beside the real cluster, which
    /// is precisely the empty picture the gate exists to prevent. An anchor
    /// with no edges is not a graph, it is a node.
    pub connected_project_count: u32,
    /// Notes exactly one hop out. Global, so it says nothing about whether any
    /// *particular* anchor is connected — see above.
    pub hop_one_count: u32,
    /// Nodes the cap removed. Surfaced, never silent — a truncated view that
    /// looks complete is the failure this project keeps designing against.
    pub dropped: u32,
    /// Files excluded as scaffolding, for the same reason.
    pub excluded_scaffold: u32,
    /// Link targets that resolved to nothing. Not nodes; counted so a vault
    /// full of dead links is visible rather than merely absent.
    pub broken_links: u32,
}

fn relative(vault: &Path, path: &Path) -> String {
    path.strip_prefix(vault)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// Directories whose shape is duplicated elsewhere in the vault.
///
/// This is what "instantiated from a template" looks like on disk. These files
/// carry no frontmatter and no marker, and only 4 of 16 are still byte-identical
/// to their originals, so neither a `type:` field nor a content hash finds them.
/// What *is* reliable is that a template and its instances share a child-folder
/// shape, and that shape appears more than once.
///
/// Named folders were the alternative and were rejected: the rule has to keep
/// working when a third scaffold folder appears, without anyone editing a list.
fn scaffold_roots(vault: &Path) -> HashSet<PathBuf> {
    let mut by_shape: HashMap<String, Vec<PathBuf>> = HashMap::new();

    for entry in WalkDir::new(vault)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .flatten()
    {
        if !entry.file_type().is_dir() {
            continue;
        }

        let Ok(children) = fs::read_dir(entry.path()) else {
            continue;
        };

        let mut names: Vec<String> = children
            .flatten()
            .filter(|child| child.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .map(|child| child.file_name().to_string_lossy().to_string())
            .filter(|name| !name.starts_with('.'))
            .collect();

        // An empty shape is every leaf folder in the vault; it would match
        // everything and exclude the library wholesale.
        if names.is_empty() {
            continue;
        }

        names.sort();
        by_shape
            .entry(names.join("|"))
            .or_default()
            .push(entry.path().to_path_buf());
    }

    by_shape
        .into_values()
        .filter(|dirs| dirs.len() > 1)
        .flatten()
        .collect()
}

/// Scaffolding is excluded because it was never meant to link. Debris — a test
/// entry, a stray README in a research folder — is *kept*: a file that should
/// not be there is a real finding, and the rim exists to show it.
fn is_scaffold(vault: &Path, path: &Path, roots: &HashSet<PathBuf>) -> bool {
    if roots.iter().any(|root| path.starts_with(root)) {
        return true;
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    let _ = vault;
    name.contains("template")
}

fn extract_links(content: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let bytes = content.as_bytes();
    let mut index = 0;

    while index + 1 < bytes.len() {
        if bytes[index] == b'[' && bytes[index + 1] == b'[' {
            if let Some(end) = content[index + 2..].find("]]") {
                let raw = &content[index + 2..index + 2 + end];
                // `[[Note|alias]]` and `[[Note#heading]]` both point at `Note`.
                let target = raw
                    .split('|')
                    .next()
                    .unwrap_or(raw)
                    .split('#')
                    .next()
                    .unwrap_or(raw)
                    .trim()
                    .to_string();
                if !target.is_empty() {
                    targets.push(target);
                }
                index += end + 4;
                continue;
            }
        }
        index += 1;
    }

    targets
}

/// Link targets are matched on file stem, which is how Obsidian resolves them.
fn stem_of(target: &str) -> String {
    let name = target.rsplit('/').next().unwrap_or(target);
    let base = name.rsplit_once('.').map(|(head, _)| head).unwrap_or(name);
    base.trim().to_ascii_lowercase()
}

pub fn build_vault_graph() -> Result<VaultGraph, String> {
    let vault = get_vault_path();
    if !vault.exists() {
        return Err(format!("Vault path does not exist: {}", vault.display()));
    }

    let roots = scaffold_roots(&vault);
    let mut files: Vec<PathBuf> = Vec::new();
    let mut excluded_scaffold = 0u32;

    for entry in WalkDir::new(&vault)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .flatten()
    {
        let path = entry.path();
        if !entry.file_type().is_file() || path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        if is_scaffold(&vault, path, &roots) {
            excluded_scaffold += 1;
            continue;
        }

        files.push(path.to_path_buf());
    }

    // Stable ordering, so the layout the frontend derives is stable too.
    files.sort();

    let mut by_stem: HashMap<String, usize> = HashMap::new();
    for (index, path) in files.iter().enumerate() {
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();
        by_stem.entry(stem).or_insert(index);
    }

    let cached = LINK_CACHE.lock().map(|guard| guard.clone()).unwrap_or_default();
    let mut fresh: HashMap<PathBuf, (SystemTime, Vec<String>)> = HashMap::new();

    let mut adjacency: Vec<HashSet<usize>> = vec![HashSet::new(); files.len()];
    let mut edges: Vec<GraphEdge> = Vec::new();
    let mut broken_links = 0u32;
    let mut seen_edges: HashSet<(usize, usize)> = HashSet::new();

    for (index, path) in files.iter().enumerate() {
        let mtime = fs::metadata(path)
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);

        let targets = match cached.get(path) {
            Some((cached_mtime, cached_targets)) if *cached_mtime == mtime => cached_targets.clone(),
            _ => match fs::read_to_string(path) {
                Ok(content) => extract_links(&content),
                Err(_) => Vec::new(),
            },
        };

        for target in &targets {
            match by_stem.get(&stem_of(target)) {
                // Broken targets are not nodes. Four of this vault's are a
                // canvas, a base, a PDF and a bare folder — none is a note.
                None => broken_links += 1,
                Some(&other) if other != index => {
                    adjacency[index].insert(other);
                    adjacency[other].insert(index);
                    let key = (index.min(other), index.max(other));
                    if seen_edges.insert(key) {
                        edges.push(GraphEdge {
                            from: relative(&vault, &files[index]),
                            to: relative(&vault, &files[other]),
                        });
                    }
                }
                Some(_) => {}
            }
        }

        fresh.insert(path.clone(), (mtime, targets));
    }

    if let Ok(mut guard) = LINK_CACHE.lock() {
        *guard = fresh;
    }

    let project_paths: HashSet<String> = load_project_notes()
        .note_paths()
        .into_iter()
        .map(|p| p.to_string())
        .collect();

    let mut hops: Vec<Option<u32>> = vec![None; files.len()];
    let mut queue: VecDeque<usize> = VecDeque::new();
    for (index, path) in files.iter().enumerate() {
        if project_paths.contains(&relative(&vault, path)) {
            hops[index] = Some(0);
            queue.push_back(index);
        }
    }

    while let Some(index) = queue.pop_front() {
        let depth = hops[index].unwrap_or(0);
        let neighbours: Vec<usize> = adjacency[index].iter().copied().collect();
        for other in neighbours {
            if hops[other].is_none() {
                hops[other] = Some(depth + 1);
                queue.push_back(other);
            }
        }
    }

    let mut nodes: Vec<GraphNode> = files
        .iter()
        .enumerate()
        .map(|(index, path)| {
            let id = relative(&vault, path);
            GraphNode {
                title: path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| id.clone()),
                folder: id.split('/').next().unwrap_or("").to_string(),
                hop: hops[index],
                is_project: project_paths.contains(&id),
                degree: adjacency[index].len() as u32,
                id,
            }
        })
        .collect();

    let project_count = nodes.iter().filter(|n| n.is_project).count() as u32;
    let connected_project_count = nodes
        .iter()
        .filter(|n| n.is_project && n.degree > 0)
        .count() as u32;
    let hop_one_count = nodes.iter().filter(|n| n.hop == Some(1)).count() as u32;

    // Past the cap, the furthest go first and the least connected go next —
    // dropping the periphery rather than the structure.
    let mut dropped = 0u32;
    if nodes.len() > NODE_CAP {
        nodes.sort_by(|a, b| {
            let rank = |n: &GraphNode| n.hop.unwrap_or(u32::MAX);
            rank(a)
                .cmp(&rank(b))
                .then(b.degree.cmp(&a.degree))
                .then(a.id.cmp(&b.id))
        });
        dropped = (nodes.len() - NODE_CAP) as u32;
        nodes.truncate(NODE_CAP);
    }

    let kept: HashSet<&String> = nodes.iter().map(|n| &n.id).collect();
    let edges = edges
        .into_iter()
        .filter(|edge| kept.contains(&edge.from) && kept.contains(&edge.to))
        .collect();

    nodes.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(VaultGraph {
        nodes,
        edges,
        project_count,
        connected_project_count,
        hop_one_count,
        dropped,
        excluded_scaffold,
        broken_links,
    })
}

#[tauri::command]
pub async fn fetch_vault_graph() -> Result<VaultGraph, String> {
    tauri::async_runtime::spawn_blocking(build_vault_graph)
        .await
        .map_err(|error| format!("Vault graph scan panicked: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_plain_aliased_and_headed_links() {
        let links = extract_links("see [[Alpha]] and [[Beta|B]] and [[Gamma#Section]] end");
        assert_eq!(links, vec!["Alpha", "Beta", "Gamma"]);
    }

    #[test]
    fn ignores_unterminated_brackets() {
        assert!(extract_links("[[never closed").is_empty());
    }

    #[test]
    fn stem_matching_ignores_folders_and_extensions() {
        assert_eq!(stem_of("02 - Research/Some Note.md"), "some note");
        assert_eq!(stem_of("Olympus Map.canvas"), "olympus map");
    }

    /// The real vault, printed. Asserts its own precondition so it cannot pass
    /// by scanning nothing — the failure mode five other debug tests had.
    #[test]
    fn debug_build_the_real_vault_graph() {
        let vault = get_vault_path();
        if !vault.exists() {
            eprintln!("[vault_graph] vault absent, skipping");
            return;
        }

        let graph = build_vault_graph().expect("graph builds");
        assert!(
            !graph.nodes.is_empty(),
            "the real vault produced no nodes, so this test asserted nothing"
        );

        eprintln!("=== VAULT GRAPH ===");
        eprintln!(
            "nodes={} edges={} projects={} connectedProjects={} hop1={} orphans={} scaffoldExcluded={} broken={} dropped={}",
            graph.nodes.len(),
            graph.edges.len(),
            graph.project_count,
            graph.connected_project_count,
            graph.hop_one_count,
            graph.nodes.iter().filter(|n| n.hop.is_none()).count(),
            graph.excluded_scaffold,
            graph.broken_links,
            graph.dropped
        );
        for node in graph.nodes.iter().filter(|n| n.hop.is_none()) {
            eprintln!("  orphan: {}", node.id);
        }
        eprintln!("=== END ===");
    }
}
