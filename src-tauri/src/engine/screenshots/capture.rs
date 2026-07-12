use image::RgbImage;
use sqlx::{Pool, Sqlite};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use tokio::time::{sleep, Duration};
use webp::{Encoder, WebPMemory};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
    GetDC, GetObjectW, ReleaseDC, SelectObject, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    DIB_RGB_COLORS, SRCCOPY,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
};

use crate::engine::screenshots::{cleanup_old, load_settings};

const SCREENSHOTS_DIR: &str = "screenshots";
const THUMB_WIDTH: u32 = 320;

pub async fn run<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let pool = crate::data::sqlite_pool::wait_for_sqlite_pool(&app)
        .await
        .map_err(|e| format!("get db pool: {e}"))?;
    let screenshots_dir = screenshots_dir(&app)?;
    std::fs::create_dir_all(&screenshots_dir)
        .map_err(|e| format!("create dir: {e}"))?;

    loop {
        let settings = load_settings(&pool).await;
        let tracking_paused = crate::data::repositories::tracker_settings::load_tracking_paused_setting(&pool)
            .await
            .unwrap_or(false);

        if settings.enabled && !tracking_paused {
            if let Err(e) = capture_and_save(&pool, &screenshots_dir).await {
                eprintln!("[screenshots] capture failed: {e}");
            }
            cleanup_old(&pool, &screenshots_dir, settings.retention_days).await;
        }
        sleep(Duration::from_secs(settings.interval_secs)).await;
    }
}

async fn capture_and_save(pool: &Pool<Sqlite>, screenshots_dir: &Path) -> Result<(), String> {
    let (data, width, height) = capture_bitblt()?;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    let session_id: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM sessions
         WHERE start_time <= ?1
           AND (end_time IS NULL OR end_time > ?1)
         ORDER BY start_time DESC, id DESC
         LIMIT 1",
    )
    .bind(now_ms)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let file_name = format_datetime_for_filename(now_ms);
    let file_path = screenshots_dir.join(&file_name);
    let file_path_str = file_path.to_string_lossy().to_string();

    let img = RgbImage::from_raw(width, height, data)
        .ok_or("failed to create RGB image")?;

    let thumb_base64 = {
        let encoder = Encoder::from_rgb(&img, width, height);
        let webp_image: WebPMemory = encoder.encode(85.0);
        let webp_bytes: Vec<u8> = webp_image.to_vec();
        std::fs::write(&file_path, &webp_bytes)
            .map_err(|e| format!("write webp: {e}"))?;

        let thumb = image::imageops::resize(
            &img,
            THUMB_WIDTH,
            (THUMB_WIDTH * height / width).max(1),
            image::imageops::FilterType::Lanczos3,
        );
        let thumb_encoder = Encoder::from_rgb(&thumb, thumb.width(), thumb.height());
        let thumb_webp: WebPMemory = thumb_encoder.encode(50.0);
        BASE64.encode(&*thumb_webp)
    };

    sqlx::query(
        "INSERT INTO screenshots (file_path, captured_at, width, height, thumbnail_base64, session_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&file_path_str)
    .bind(now_ms)
    .bind(width as i64)
    .bind(height as i64)
    .bind(&thumb_base64)
    .bind(session_id)
    .execute(pool)
    .await
    .map_err(|e| format!("insert: {e}"))?;

    Ok(())
}

fn capture_bitblt() -> Result<(Vec<u8>, u32, u32), String> {
    unsafe {
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN) as u32;
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN) as u32;
        if width == 0 || height == 0 {
            return Err("zero screen dimensions".into());
        }

        let hdc_screen = GetDC(None);
        if hdc_screen.is_invalid() {
            return Err("GetDC failed".into());
        }

        let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
        if hdc_mem.is_invalid() {
            let _ = ReleaseDC(None, hdc_screen);
            return Err("CreateCompatibleDC failed".into());
        }

        let hbitmap = CreateCompatibleBitmap(hdc_screen, width as i32, height as i32);
        if hbitmap.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(None, hdc_screen);
            return Err("CreateCompatibleBitmap failed".into());
        }

        SelectObject(hdc_mem, hbitmap.into());
        let _ = BitBlt(
            hdc_mem, 0, 0, width as i32, height as i32, Some(hdc_screen), 0, 0, SRCCOPY,
        );

        let mut bmp: BITMAP = std::mem::zeroed();
        GetObjectW(
            hbitmap.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut _ as _),
        );

        let row_size = ((bmp.bmWidth * 24 + 31) / 32) * 4;
        let pixel_size = (row_size as u32) * (bmp.bmHeight as u32);
        let mut buf = vec![0u8; pixel_size as usize];

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = bmp.bmWidth;
        bmi.bmiHeader.biHeight = -bmp.bmHeight;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 24;
        bmi.bmiHeader.biCompression = 0;

        GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            bmp.bmHeight as u32,
            Some(buf.as_mut_ptr() as _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = DeleteObject(hbitmap.into());
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(None, hdc_screen);

        for chunk in buf.chunks_exact_mut(3) {
            chunk.swap(0, 2);
        }

        Ok((buf, width, height))
    }
}

fn screenshots_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    crate::platform::app_paths::product_roaming_data_dir(app).map(|p| p.join(SCREENSHOTS_DIR))
}

fn format_datetime_for_filename(ms: i64) -> String {
    use chrono::{TimeZone, Local};
    let dt = Local.timestamp_millis_opt(ms).single().unwrap_or_else(Local::now);
    dt.format("%Y-%m-%d %H.%M.%S").to_string() + ".webp"
}
