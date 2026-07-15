use futures_util::StreamExt;
use reqwest::{Body, Method, StatusCode, Url};
use std::path::Path;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;

const MAX_TRANSFER_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WebDavConfig {
    pub url: String,
    pub username: String,
    pub remote_dir: String,
}

pub struct WebDavClient {
    client: reqwest::Client,
    base_url: Url,
    username: String,
    password: String,
}

fn parse_base_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("WebDAV server address cannot be empty".to_string());
    }

    let mut url =
        Url::parse(trimmed).map_err(|error| format!("invalid WebDAV server address: {error}"))?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("WebDAV server address must use http or https".to_string());
    }
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

pub fn normalize_remote_dir(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let candidate = if trimmed.is_empty() {
        "/Patina"
    } else {
        trimmed
    };

    if candidate.contains('\\') || candidate.contains("..") {
        return Err("WebDAV remote directory contains unsupported path segments".to_string());
    }
    if candidate.chars().any(|char| char.is_control()) {
        return Err("WebDAV remote directory contains control characters".to_string());
    }

    let mut normalized = candidate.replace("//", "/");
    if !normalized.starts_with('/') {
        normalized = format!("/{normalized}");
    }
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    Ok(normalized)
}

fn split_path(path: &str) -> impl Iterator<Item = &str> {
    path.trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
}

impl WebDavClient {
    pub fn new(config: &WebDavConfig, password: String) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(8))
            .build()
            .map_err(|error| format!("failed to create WebDAV client: {error}"))?;

        Ok(Self {
            client,
            base_url: parse_base_url(&config.url)?,
            username: config.username.trim().to_string(),
            password,
        })
    }

    fn remote_url(&self, remote_path: &str) -> Result<Url, String> {
        let mut url = self.base_url.clone();
        let base_segments = url
            .path_segments()
            .map(|segments| {
                segments
                    .filter(|segment| !segment.is_empty())
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        {
            let mut segments = url
                .path_segments_mut()
                .map_err(|_| "WebDAV server address cannot be used as a base URL".to_string())?;
            segments.clear();
            for segment in base_segments {
                segments.push(&segment);
            }
            for segment in split_path(remote_path) {
                segments.push(segment);
            }
        }

        Ok(url)
    }

    async fn request(
        &self,
        method: Method,
        remote_path: &str,
    ) -> Result<reqwest::RequestBuilder, String> {
        let url = self.remote_url(remote_path)?;
        Ok(self
            .client
            .request(method, url)
            .basic_auth(&self.username, Some(&self.password)))
    }

    pub async fn ping(&self, remote_dir: &str) -> Result<(), String> {
        self.ensure_dir(remote_dir).await
    }

    pub async fn ensure_dir(&self, remote_dir: &str) -> Result<(), String> {
        let normalized = normalize_remote_dir(remote_dir)?;
        let mut current = String::new();
        for segment in split_path(&normalized) {
            current.push('/');
            current.push_str(segment);
            let response = self
                .request(
                    Method::from_bytes(b"MKCOL").map_err(|error| error.to_string())?,
                    &current,
                )
                .await?
                .send()
                .await
                .map_err(|error| format!("failed to create WebDAV directory: {error}"))?;
            let status = response.status();
            if status == StatusCode::CREATED
                || status == StatusCode::METHOD_NOT_ALLOWED
                || status == StatusCode::OK
                || status == StatusCode::CONFLICT
            {
                continue;
            }
            return Err(format!("failed to create WebDAV directory: HTTP {status}"));
        }
        Ok(())
    }

    pub async fn read_text_optional(&self, remote_path: &str) -> Result<Option<String>, String> {
        let response = self
            .request(Method::GET, remote_path)
            .await?
            .send()
            .await
            .map_err(|error| format!("failed to read WebDAV file: {error}"))?;
        let status = response.status();
        if status == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !status.is_success() {
            return Err(format!("failed to read WebDAV file: HTTP {status}"));
        }
        response
            .text()
            .await
            .map(Some)
            .map_err(|error| format!("failed to read WebDAV response: {error}"))
    }

    pub async fn write_text(&self, remote_path: &str, value: &str) -> Result<(), String> {
        let response = self
            .request(Method::PUT, remote_path)
            .await?
            .header("Content-Type", "application/json; charset=utf-8")
            .body(value.to_string())
            .send()
            .await
            .map_err(|error| format!("failed to write WebDAV file: {error}"))?;
        let status = response.status();
        if status.is_success() {
            Ok(())
        } else {
            Err(format!("failed to write WebDAV file: HTTP {status}"))
        }
    }

    pub async fn upload_file(&self, local_path: &Path, remote_path: &str) -> Result<(), String> {
        let file = tokio::fs::File::open(local_path)
            .await
            .map_err(|error| format!("failed to read local backup before upload: {error}"))?;
        let size = file
            .metadata()
            .await
            .map_err(|error| format!("failed to read local backup metadata: {error}"))?
            .len();
        if size > MAX_TRANSFER_BYTES {
            return Err("local backup exceeds the WebDAV transfer size limit".to_string());
        }
        let body = Body::wrap_stream(ReaderStream::new(file));
        let response = self
            .request(Method::PUT, remote_path)
            .await?
            .header("Content-Type", "application/zip")
            .header("Content-Length", size)
            .body(body)
            .send()
            .await
            .map_err(|error| format!("failed to upload WebDAV backup: {error}"))?;
        let status = response.status();
        if status.is_success() {
            Ok(())
        } else {
            Err(format!("failed to upload WebDAV backup: HTTP {status}"))
        }
    }

    pub async fn download_file(&self, remote_path: &str, local_path: &Path) -> Result<(), String> {
        let response = self
            .request(Method::GET, remote_path)
            .await?
            .send()
            .await
            .map_err(|error| format!("failed to download WebDAV backup: {error}"))?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("failed to download WebDAV backup: HTTP {status}"));
        }
        if response
            .content_length()
            .is_some_and(|size| size > MAX_TRANSFER_BYTES)
        {
            return Err("remote backup exceeds the WebDAV transfer size limit".to_string());
        }
        if let Some(parent) = local_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|error| format!("failed to create backup download dir: {error}"))?;
        }
        let partial_path = local_path.with_extension("zip.partial");
        for stale_path in [local_path, partial_path.as_path()] {
            match tokio::fs::remove_file(stale_path).await {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!("failed to clear stale backup download: {error}"));
                }
            }
        }
        let mut file = tokio::fs::File::create(&partial_path)
            .await
            .map_err(|error| format!("failed to create downloaded backup: {error}"))?;
        let mut received = 0_u64;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(chunk) => chunk,
                Err(error) => {
                    drop(file);
                    let _ = tokio::fs::remove_file(&partial_path).await;
                    return Err(format!("failed to read WebDAV backup response: {error}"));
                }
            };
            received = received.saturating_add(chunk.len() as u64);
            if received > MAX_TRANSFER_BYTES {
                let _ = tokio::fs::remove_file(&partial_path).await;
                return Err("remote backup exceeds the WebDAV transfer size limit".to_string());
            }
            if let Err(error) = file.write_all(&chunk).await {
                let _ = tokio::fs::remove_file(&partial_path).await;
                return Err(format!("failed to write downloaded backup: {error}"));
            }
        }
        if let Err(error) = file.flush().await {
            drop(file);
            let _ = tokio::fs::remove_file(&partial_path).await;
            return Err(format!("failed to flush downloaded backup: {error}"));
        }
        drop(file);
        tokio::fs::rename(&partial_path, local_path)
            .await
            .map_err(|error| format!("failed to publish downloaded backup: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_remote_dir;

    #[test]
    fn normalize_remote_dir_applies_default_and_slashes() {
        assert_eq!(normalize_remote_dir("").unwrap(), "/Patina");
        assert_eq!(
            normalize_remote_dir("Patina/backups/").unwrap(),
            "/Patina/backups"
        );
    }

    #[test]
    fn normalize_remote_dir_rejects_unsafe_segments() {
        assert!(normalize_remote_dir("../zotero").is_err());
        assert!(normalize_remote_dir("Patina\\backups").is_err());
        assert!(normalize_remote_dir("Patina/\n/backups").is_err());
    }
}
