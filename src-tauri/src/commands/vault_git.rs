//! Exact-file Git commits for approved Olympus vault writes.
//!
//! The operator may have unrelated staged or unstaged vault edits. A normal
//! `git add` plus `git commit` would adopt them. This module builds a commit
//! from a temporary index seeded from HEAD, proves its tree changes exactly the
//! requested path, then advances the current branch with an atomic old-value
//! check. The real index is only refreshed for the committed path afterward.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use super::get_vault_path;

pub fn commit_vault_file(
    relative_path: &str,
    operation: &str,
) -> Result<Option<String>, String> {
    commit_exact_file_in(&get_vault_path(), Path::new(relative_path), operation)
}

fn git(
    root: &Path,
    args: &[&str],
    temporary_index: Option<&Path>,
) -> Result<String, String> {
    let mut command = Command::new("git");
    command.arg("-C").arg(root).args(args);

    if let Some(index) = temporary_index {
        command.env("GIT_INDEX_FILE", index);
    }

    let output = command.output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            detail
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn temp_index_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    std::env::temp_dir().join(format!(
        "olympus-vault-index-{}-{nanos}",
        std::process::id()
    ))
}

fn commit_exact_file_in(
    root: &Path,
    relative: &Path,
    operation: &str,
) -> Result<Option<String>, String> {
    if relative.as_os_str().is_empty() || relative.is_absolute() {
        return Err("The vault commit path must be relative.".to_string());
    }

    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let top_level = PathBuf::from(git(root, &["rev-parse", "--show-toplevel"], None)?)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if top_level != canonical_root {
        return Err("The configured vault is not the root of its Git repository.".to_string());
    }

    let relative_text = relative.to_string_lossy().replace('\\', "/");
    if !canonical_root.join(relative).exists() {
        return Err(format!("The written vault file does not exist: {relative_text}"));
    }

    let changed = git(
        root,
        &["status", "--porcelain", "--", &relative_text],
        None,
    )?;
    if changed.trim().is_empty() {
        return Ok(None);
    }

    let old_head = git(root, &["rev-parse", "HEAD"], None)?;
    let branch_ref = git(root, &["symbolic-ref", "-q", "HEAD"], None)
        .map_err(|_| "The vault is on a detached HEAD; Olympus will not advance it.".to_string())?;
    let index = temp_index_path();

    let result = (|| -> Result<String, String> {
        git(root, &["read-tree", &old_head], Some(&index))?;
        git(root, &["add", "--", &relative_text], Some(&index))?;
        let tree = git(root, &["write-tree"], Some(&index))?;
        let message = format!("olympus: {operation} {relative_text}");
        let commit = git(
            root,
            &["commit-tree", &tree, "-p", &old_head, "-m", &message],
            Some(&index),
        )?;

        let names = git(
            root,
            &["diff-tree", "--no-commit-id", "--name-only", "-r", &commit],
            None,
        )?;
        let changed_paths: Vec<&str> = names.lines().filter(|line| !line.trim().is_empty()).collect();
        if changed_paths != vec![relative_text.as_str()] {
            return Err(format!(
                "Refusing a vault commit whose tree changed {:?} instead of only {}.",
                changed_paths, relative_text
            ));
        }

        git(
            root,
            &["update-ref", &branch_ref, &commit, &old_head],
            None,
        )?;

        // Synchronise only the committed path in the operator's real index.
        // Other staged changes remain exactly as they were.
        git(root, &["reset", "-q", "HEAD", "--", &relative_text], None)?;
        Ok(commit)
    })();

    let _ = fs::remove_file(&index);
    result.map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(root: &Path, args: &[&str]) {
        git(root, args, None).unwrap();
    }

    fn repo(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("olympus-vault-git-{name}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        run(&root, &["init"]);
        run(&root, &["config", "user.name", "Olympus Test"]);
        run(&root, &["config", "user.email", "olympus@example.invalid"]);
        fs::write(root.join("target.md"), "before\n").unwrap();
        fs::write(root.join("unrelated.md"), "before\n").unwrap();
        run(&root, &["add", "."]);
        run(&root, &["commit", "-m", "seed"]);
        root
    }

    #[test]
    fn commits_only_the_written_path_and_preserves_other_staging() {
        let root = repo("exact");
        fs::write(root.join("target.md"), "after\n").unwrap();
        fs::write(root.join("unrelated.md"), "human edit\n").unwrap();
        run(&root, &["add", "unrelated.md"]);

        let commit = commit_exact_file_in(&root, Path::new("target.md"), "update")
            .unwrap()
            .expect("changed file gets a commit");

        assert_eq!(
            git(
                &root,
                &["diff-tree", "--no-commit-id", "--name-only", "-r", &commit],
                None
            )
            .unwrap(),
            "target.md"
        );
        assert_eq!(
            git(&root, &["diff", "--cached", "--name-only"], None).unwrap(),
            "unrelated.md"
        );
        assert_eq!(
            git(&root, &["show", "HEAD:target.md"], None).unwrap(),
            "after"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn commits_a_new_file_without_adopting_another_untracked_file() {
        let root = repo("new");
        fs::write(root.join("created.md"), "new\n").unwrap();
        fs::write(root.join("leave-alone.md"), "human\n").unwrap();

        commit_exact_file_in(&root, Path::new("created.md"), "create")
            .unwrap()
            .expect("new file gets a commit");

        assert_eq!(
            git(
                &root,
                &["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
                None
            )
            .unwrap(),
            "created.md"
        );
        assert!(root.join("leave-alone.md").exists());
        assert!(git(&root, &["status", "--porcelain"], None)
            .unwrap()
            .contains("leave-alone.md"));
        let _ = fs::remove_dir_all(root);
    }
}
