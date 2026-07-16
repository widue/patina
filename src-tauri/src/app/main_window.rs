use crate::app::state::{AppExitState, DesktopBehaviorState, MainWindowLifecycleState};
use crate::app::widget;
use crate::domain::settings::MinimizeBehavior;
use crate::platform::storage_paths;
use crate::platform::windows::window_activation;
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window};

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";

const MAIN_WINDOW_TITLE: &str = "Patina";
const MAIN_WINDOW_WIDTH: f64 = 1100.0;
const MAIN_WINDOW_HEIGHT: f64 = 736.0;
const MAIN_WINDOW_MIN_WIDTH: f64 = 900.0;
const MAIN_WINDOW_MIN_HEIGHT: f64 = 636.0;
const MAIN_WINDOW_DESTROY_AFTER_BACKGROUND_SECS: u64 = 3 * 60;

pub(crate) fn show_main_window<R: Runtime + 'static>(app: &AppHandle<R>) {
    if app.state::<MainWindowLifecycleState>().show() {
        return;
    }

    let window = match ensure_main_window(app) {
        Ok(window) => window,
        Err(error) => {
            eprintln!("[main-window] failed to ensure main window: {error}");
            return;
        }
    };

    let _ = window.show();
    let _ = window.unminimize();
    // Win+D can leave the HWND outside Tauri's normal minimized/visible path.
    if let Err(error) = window_activation::restore_to_foreground(&window) {
        eprintln!("[main-window] failed to restore native foreground window: {error}");
    }
    let _ = window.set_focus();
    widget::close_widget_window(app);
}

pub(crate) fn minimize_main_window<R: Runtime + 'static>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let settings = app.state::<DesktopBehaviorState>().snapshot();
    if settings.minimize_behavior == MinimizeBehavior::Widget {
        minimize_main_window_to_widget(app, &window);
        return;
    }

    if let Err(error) = window.minimize() {
        eprintln!("[main-window] failed to minimize main window: {error}");
    }
}

fn minimize_main_window_to_widget<R: Runtime + 'static>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) {
    let preferred_monitor = window.current_monitor().ok().flatten();
    let _ = window.hide();
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = widget::show_widget_window(&app_handle, preferred_monitor).await {
            eprintln!("[widget] failed to show widget window: {error}");
        }
    });
}

pub(crate) fn hide_main_window_for_background<R: Runtime + 'static>(
    app: &AppHandle<R>,
    window: &Window<R>,
) {
    let hide_generation = app.state::<MainWindowLifecycleState>().hide();
    let _ = window.hide();

    if app
        .state::<DesktopBehaviorState>()
        .snapshot()
        .should_optimize_background_resources()
    {
        schedule_main_window_destroy_after_background(app.clone(), hide_generation);
    }
}

pub(crate) fn register_hidden_main_window_startup<R: Runtime + 'static>(
    app: &AppHandle<R>,
    optimize_background_resources: bool,
) -> bool {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return false;
    };

    if window.is_visible().unwrap_or(false) {
        return false;
    }

    let Some(hide_generation) = app
        .state::<MainWindowLifecycleState>()
        .try_hide_for_startup()
    else {
        return false;
    };

    if optimize_background_resources {
        schedule_main_window_destroy_after_background(app.clone(), hide_generation);
    }

    true
}

pub(crate) fn ensure_main_window<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<WebviewWindow<R>, String> {
    ensure_main_window_with_initial_visibility(app, true)
}

pub(crate) fn ensure_main_window_with_initial_visibility<R: Runtime>(
    app: &AppHandle<R>,
    visible: bool,
) -> Result<WebviewWindow<R>, String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        return Ok(window);
    }

    let webview_root = storage_paths::resolve_storage_paths(app)?.webview_root;

    WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, main_window_url())
        .title(MAIN_WINDOW_TITLE)
        .inner_size(MAIN_WINDOW_WIDTH, MAIN_WINDOW_HEIGHT)
        .min_inner_size(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .center()
        .visible(visible)
        .data_directory(webview_root)
        .build()
        .map_err(|error| format!("failed to create main window: {error}"))
}

fn main_window_url() -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        let e2e_frontend_url = (std::env::var("PATINA_E2E").as_deref() == Ok("1")).then(|| {
            std::env::var("PATINA_E2E_FRONTEND_URL")
                .expect("PATINA_E2E_FRONTEND_URL is required when PATINA_E2E=1")
        });
        debug_main_window_url(e2e_frontend_url.as_deref())
    }

    #[cfg(not(debug_assertions))]
    {
        WebviewUrl::App("index.html".into())
    }
}

#[cfg(debug_assertions)]
fn debug_main_window_url(e2e_frontend_url: Option<&str>) -> WebviewUrl {
    WebviewUrl::External(
        e2e_frontend_url
            .unwrap_or("http://127.0.0.1:1420")
            .parse()
            .expect("valid dev server URL"),
    )
}

fn schedule_main_window_destroy_after_background<R: Runtime + 'static>(
    app: AppHandle<R>,
    hide_generation: u64,
) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(
            MAIN_WINDOW_DESTROY_AFTER_BACKGROUND_SECS,
        ))
        .await;

        if !app
            .state::<DesktopBehaviorState>()
            .snapshot()
            .should_optimize_background_resources()
        {
            return;
        }

        let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
            return;
        };

        if window.is_visible().unwrap_or(false) {
            return;
        }

        let lifecycle = app.state::<MainWindowLifecycleState>();
        if !lifecycle.begin_destroy_hidden_window(hide_generation) {
            return;
        }

        if let Err(error) = window.destroy() {
            eprintln!("[main-window] failed to destroy idle main window: {error}");
        }

        let should_reopen = lifecycle.finish_destroy_hidden_window();
        if should_reopen && !app.state::<AppExitState>().is_exit_requested() {
            show_main_window(&app);
        }
    });
}

#[cfg(test)]
mod tests {
    #[cfg(debug_assertions)]
    use super::debug_main_window_url;
    use super::main_window_url;
    use tauri::WebviewUrl;

    #[test]
    fn main_window_url_uses_dev_server_in_debug_builds() {
        let url = main_window_url();

        #[cfg(debug_assertions)]
        assert!(matches!(url, WebviewUrl::External(_)));

        #[cfg(not(debug_assertions))]
        assert!(matches!(url, WebviewUrl::App(_)));
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_main_window_url_accepts_isolated_e2e_frontend() {
        let url = debug_main_window_url(Some("http://127.0.0.1:43123"));

        match url {
            WebviewUrl::External(url) => assert_eq!(url.as_str(), "http://127.0.0.1:43123/"),
            _ => panic!("expected external E2E frontend URL"),
        }
    }
}
