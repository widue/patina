pub mod settings;
pub mod query;
pub mod capture;
pub mod cleanup;
pub mod types;

pub use types::{ScreenshotEntry, ScreenshotSettings, ScreenshotQueryResult, ScreenshotStats};
pub use settings::{load_settings, save_settings};
pub use query::{query_screenshots, query_screenshots_paginated, count_screenshots, get_screenshot_stats, get_screenshot_data, get_screenshot_file_path, reveal_screenshot_in_folder};
pub use cleanup::cleanup_old;
pub use capture::run;

use std::sync::atomic::AtomicBool;

pub static SCREENSHOTS_ENABLED: AtomicBool = AtomicBool::new(false);
