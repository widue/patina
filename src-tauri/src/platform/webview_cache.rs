use crate::domain::storage::{WebviewCacheEntrySnapshot, WebviewCacheSnapshot};
use crate::platform::{storage_anchor, storage_paths};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

const EBWEBVIEW_DIR_NAME: &str = "EBWebView";

const CACHE_ALLOWLIST: &[(&str, &[&str])] = &[
    ("HTTP cache", &["EBWebView", "Default", "Cache"]),
    ("JS code cache", &["EBWebView", "Default", "Code Cache"]),
    ("GPU cache", &["EBWebView", "Default", "GPUCache"]),
    ("Shader cache", &["EBWebView", "ShaderCache"]),
    ("Graphite shader cache", &["EBWebView", "GrShaderCache"]),
    (
        "Dawn Graphite cache",
        &["EBWebView", "Default", "DawnGraphiteCache"],
    ),
    (
        "Dawn WebGPU cache",
        &["EBWebView", "Default", "DawnWebGPUCache"],
    ),
];

pub fn webview_cache_snapshot<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<WebviewCacheSnapshot, String> {
    let paths = storage_paths::resolve_storage_paths(app)?;
    let state = storage_anchor::read_maintenance_state(app)
        .unwrap_or_else(|_| storage_anchor::StorageMaintenanceState::new());
    Ok(snapshot_for_root(&paths.webview_root, &state))
}

pub fn snapshot_for_root(
    webview_root: &Path,
    state: &storage_anchor::StorageMaintenanceState,
) -> WebviewCacheSnapshot {
    let entries = allowlisted_cache_paths(webview_root)
        .into_iter()
        .map(|(label, path)| WebviewCacheEntrySnapshot {
            label,
            size_bytes: safe_dir_size(&path),
            path: path.to_string_lossy().to_string(),
        })
        .collect::<Vec<_>>();
    let reclaimable_size_bytes = entries.iter().map(|entry| entry.size_bytes).sum::<u64>();
    let ebwebview_path = webview_root.join(EBWEBVIEW_DIR_NAME);
    let total_size_bytes = safe_dir_size(&ebwebview_path);

    WebviewCacheSnapshot {
        webview_root: webview_root.to_string_lossy().to_string(),
        ebwebview_path: ebwebview_path.to_string_lossy().to_string(),
        total_size_bytes,
        reclaimable_size_bytes,
        last_trim_at_ms: state.last_webview_cache_trim_at_ms,
        entries,
    }
}

pub fn ebwebview_path(webview_root: &Path) -> PathBuf {
    webview_root.join(EBWEBVIEW_DIR_NAME)
}

pub fn clear_regenerable_cache_dirs(webview_root: &Path) -> Result<(), String> {
    clear_allowlisted_cache_dirs(webview_root)
}

pub fn remove_retired_cache_root(
    webview_root: &Path,
    remove_empty_root: bool,
) -> Result<(), String> {
    let mut errors = Vec::new();
    if let Err(error) = remove_cache_dir(webview_root, &ebwebview_path(webview_root)) {
        errors.push(error);
    }
    if remove_empty_root {
        if let Err(error) = remove_empty_root_dir(webview_root) {
            errors.push(error);
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn clear_allowlisted_cache_dirs(webview_root: &Path) -> Result<(), String> {
    let mut errors = Vec::new();
    for (_, path) in allowlisted_cache_paths(webview_root) {
        if let Err(error) = remove_cache_dir(webview_root, &path) {
            errors.push(error);
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

fn allowlisted_cache_paths(webview_root: &Path) -> Vec<(String, PathBuf)> {
    CACHE_ALLOWLIST
        .iter()
        .map(|(label, segments)| {
            let mut path = webview_root.to_path_buf();
            for segment in *segments {
                path.push(segment);
            }
            ((*label).to_string(), path)
        })
        .collect()
}

fn remove_cache_dir(webview_root: &Path, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    ensure_path_inside_root(webview_root, path)?;
    if is_reparse_or_symlink(path) {
        return Ok(());
    }
    fs::remove_dir_all(path)
        .map_err(|error| format!("failed to remove cache dir `{}`: {error}", path.display()))
}

fn remove_empty_root_dir(webview_root: &Path) -> Result<(), String> {
    if !webview_root.exists() {
        return Ok(());
    }
    if is_reparse_or_symlink(webview_root) {
        return Ok(());
    }
    let mut entries = fs::read_dir(webview_root).map_err(|error| {
        format!(
            "failed to inspect cache root `{}`: {error}",
            webview_root.display()
        )
    })?;
    if entries.next().is_some() {
        return Ok(());
    }
    fs::remove_dir(webview_root).map_err(|error| {
        format!(
            "failed to remove empty cache root `{}`: {error}",
            webview_root.display()
        )
    })
}

fn ensure_path_inside_root(root: &Path, path: &Path) -> Result<(), String> {
    let root = root.canonicalize().map_err(|error| {
        format!(
            "failed to inspect webview root `{}`: {error}",
            root.display()
        )
    })?;
    let path = path
        .canonicalize()
        .map_err(|error| format!("failed to inspect cache path `{}`: {error}", path.display()))?;

    if path.starts_with(&root) {
        Ok(())
    } else {
        Err(format!(
            "refusing to remove cache path `{}` outside `{}`",
            path.display(),
            root.display()
        ))
    }
}

fn safe_dir_size(path: &Path) -> u64 {
    dir_size(path).unwrap_or(0)
}

fn dir_size(path: &Path) -> Result<u64, String> {
    if !path.exists() || is_reparse_or_symlink(path) {
        return Ok(0);
    }

    let metadata = fs::metadata(path)
        .map_err(|error| format!("failed to inspect `{}`: {error}", path.display()))?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }

    let mut total = 0;
    let entries = fs::read_dir(path)
        .map_err(|error| format!("failed to read `{}`: {error}", path.display()))?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("failed to read `{}`: {error}", path.display()))?;
        let entry_path = entry.path();
        if is_reparse_or_symlink(&entry_path) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| format!("failed to inspect `{}`: {error}", entry_path.display()))?;
        if metadata.is_dir() {
            total += dir_size(&entry_path)?;
        } else {
            total += metadata.len();
        }
    }
    Ok(total)
}

fn is_reparse_or_symlink(path: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    if metadata.file_type().is_symlink() {
        return true;
    }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    #[cfg(not(windows))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "patina-webview-cache-{label}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write_file(path: &Path, bytes: usize) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(path).unwrap();
        file.write_all(&vec![1; bytes]).unwrap();
    }

    #[test]
    fn snapshot_only_counts_allowlisted_cache_as_reclaimable() {
        let root = temp_dir("snapshot");
        write_file(
            &root
                .join("EBWebView")
                .join("Default")
                .join("Cache")
                .join("a"),
            10,
        );
        write_file(
            &root
                .join("EBWebView")
                .join("Default")
                .join("Local Storage")
                .join("keep"),
            20,
        );

        let snapshot = snapshot_for_root(&root, &storage_anchor::StorageMaintenanceState::new());
        let _ = fs::remove_dir_all(&root);

        assert_eq!(snapshot.reclaimable_size_bytes, 10);
        assert_eq!(snapshot.total_size_bytes, 30);
    }

    #[test]
    fn clear_allowlist_preserves_local_storage() {
        let root = temp_dir("clear");
        let cache_file = root
            .join("EBWebView")
            .join("Default")
            .join("Code Cache")
            .join("js")
            .join("compiled");
        let local_storage_file = root
            .join("EBWebView")
            .join("Default")
            .join("Local Storage")
            .join("keep");
        write_file(&cache_file, 10);
        write_file(&local_storage_file, 20);

        clear_regenerable_cache_dirs(&root).unwrap();

        assert!(!cache_file.exists());
        assert!(local_storage_file.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn clear_allowlist_continues_when_one_cache_path_fails() {
        let root = temp_dir("partial-clear");
        let cache_file = root.join("EBWebView").join("Default").join("Cache");
        let code_cache_file = root
            .join("EBWebView")
            .join("Default")
            .join("Code Cache")
            .join("js")
            .join("compiled");
        write_file(&cache_file, 10);
        write_file(&code_cache_file, 20);

        let error = clear_allowlisted_cache_dirs(&root).unwrap_err();

        assert!(error.contains("failed to remove cache dir"));
        assert!(cache_file.exists());
        assert!(!code_cache_file.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn remove_retired_cache_root_removes_ebwebview_and_empty_root() {
        let root = temp_dir("retired-empty");
        let local_storage_file = root
            .join("EBWebView")
            .join("Default")
            .join("Local Storage")
            .join("keep");
        write_file(&local_storage_file, 20);

        remove_retired_cache_root(&root, true).unwrap();

        assert!(!root.exists());
    }

    #[test]
    fn remove_retired_cache_root_keeps_nonempty_root() {
        let root = temp_dir("retired-nonempty");
        let cache_file = root
            .join("EBWebView")
            .join("Default")
            .join("Cache")
            .join("entry");
        let user_file = root.join("notes.txt");
        write_file(&cache_file, 10);
        write_file(&user_file, 5);

        remove_retired_cache_root(&root, true).unwrap();

        assert!(!root.join("EBWebView").exists());
        assert!(user_file.exists());
        let _ = fs::remove_dir_all(&root);
    }
}
