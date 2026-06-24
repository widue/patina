use crate::app::main_window;
use crate::app::runtime::now_ms;
use crate::app::state::{AppExitState, DesktopBehaviorState};
use crate::app::widget;
use crate::data::repositories::tracker_settings;
use crate::data::sqlite_pool::wait_for_sqlite_pool;
use crate::domain::settings::{CloseBehavior, DesktopBehaviorSettings};
use crate::engine::tracking::runtime as tracking_runtime;
use sqlx::{Pool, Sqlite};
use tauri::{
    menu::{Menu, MenuEvent, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime, Window, WindowEvent,
};

pub(crate) use crate::app::main_window::MAIN_WINDOW_LABEL;
const TRAY_ID: &str = "main";
const TRAY_MENU_SHOW_ID: &str = "tray-show-main";
const TRAY_MENU_TOGGLE_PAUSE_ID: &str = "tray-toggle-pause";
const TRAY_MENU_QUIT_ID: &str = "tray-quit";
const TRAY_MENU_SHOW_LABEL: &str = "打开主界面";
const TRAY_MENU_PAUSE_LABEL: &str = "暂停追踪";
const TRAY_MENU_RESUME_LABEL: &str = "恢复追踪";
const TRAY_MENU_QUIT_LABEL: &str = "退出应用";

fn tracking_pause_menu_label(tracking_paused: bool) -> &'static str {
    if tracking_paused {
        TRAY_MENU_RESUME_LABEL
    } else {
        TRAY_MENU_PAUSE_LABEL
    }
}

fn should_redirect_close_to_tray(settings: DesktopBehaviorSettings, exit_requested: bool) -> bool {
    !exit_requested
        && settings.close_behavior == CloseBehavior::Tray
        && settings.should_keep_tray_visible()
}

pub(crate) fn show_main_window<R: Runtime + 'static>(app: &AppHandle<R>) {
    main_window::show_main_window(app);
}

pub(crate) fn apply_tray_visibility<R: Runtime>(
    app: &AppHandle<R>,
    settings: DesktopBehaviorSettings,
) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Err(error) = tray.set_visible(settings.should_keep_tray_visible()) {
            eprintln!("[tray] failed to apply visibility: {error}");
        }
    }
}

pub(crate) async fn toggle_tracking_paused<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let pool = wait_for_sqlite_pool(&app).await?;
    let (tracking_paused, reason) = toggle_tracking_paused_in_pool(&pool)
        .await
        .map_err(|error| format!("failed to toggle tracking pause setting: {error}"))?;

    if let Err(error) = apply_tracking_pause_menu_label(&app, tracking_paused) {
        eprintln!("[tray] failed to update tracking pause menu label: {error}");
    }

    tracking_runtime::emit_tracking_data_changed(&app, reason, now_ms())
        .map_err(|error| format!("failed to emit tracking pause event: {error}"))?;

    Ok(())
}

pub(crate) async fn toggle_tracking_paused_in_pool(
    pool: &Pool<Sqlite>,
) -> Result<(bool, &'static str), sqlx::Error> {
    let current = tracker_settings::load_tracking_paused_setting(pool).await?;
    let next = !current;

    tracker_settings::save_tracking_paused_setting(pool, next).await?;

    let reason = if next {
        "tracking-paused"
    } else {
        "tracking-resumed"
    };

    Ok((next, reason))
}

fn apply_tracking_pause_menu_label<R: Runtime>(
    app: &AppHandle<R>,
    tracking_paused: bool,
) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = build_tray_menu(app, tracking_paused)?;
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

pub(crate) fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id() == TRAY_MENU_SHOW_ID {
        show_main_window(app);
        return;
    }

    if event.id() == TRAY_MENU_TOGGLE_PAUSE_ID {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = toggle_tracking_paused(app_handle).await {
                eprintln!("[tray] failed to toggle tracking pause: {error}");
            }
        });
        return;
    }

    if event.id() == TRAY_MENU_QUIT_ID {
        app.state::<AppExitState>().request_exit();
        app.exit(0);
    }
}

pub(crate) fn handle_tray_icon_event<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
        | TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            show_main_window(app);
        }
        _ => {}
    }
}

pub(crate) fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() == widget::WIDGET_WINDOW_LABEL {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            show_main_window(window.app_handle());
        }
        return;
    }

    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    let app = window.app_handle();

    if matches!(event, WindowEvent::Focused(true)) && window.is_visible().unwrap_or(false) {
        widget::close_widget_window(app);
        return;
    }

    let state = app.state::<DesktopBehaviorState>();
    let settings = state.snapshot();
    let exit_requested = app.state::<AppExitState>().is_exit_requested();

    if let WindowEvent::CloseRequested { api, .. } = event {
        if should_redirect_close_to_tray(settings, exit_requested) {
            api.prevent_close();
            widget::close_widget_window(app);
            main_window::hide_main_window_for_background(app, window);
        }
    }
}

pub(crate) fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let tracking_paused = tauri::async_runtime::block_on(async {
        let pool = wait_for_sqlite_pool(app).await?;
        tracker_settings::load_tracking_paused_setting(&pool)
            .await
            .map_err(|error| error.to_string())
    })
    .unwrap_or_else(|error| {
        eprintln!("[tray] failed to initialize tracking pause menu label: {error}");
        false
    });

    let menu = build_tray_menu(app, tracking_paused)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Patina")
        .show_menu_on_left_click(false);

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    tracking_paused: bool,
) -> tauri::Result<Menu<R>> {
    let open_item = MenuItem::with_id(
        app,
        TRAY_MENU_SHOW_ID,
        TRAY_MENU_SHOW_LABEL,
        true,
        None::<&str>,
    )?;
    let toggle_pause_item = MenuItem::with_id(
        app,
        TRAY_MENU_TOGGLE_PAUSE_ID,
        tracking_pause_menu_label(tracking_paused),
        true,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(
        app,
        TRAY_MENU_QUIT_ID,
        TRAY_MENU_QUIT_LABEL,
        true,
        None::<&str>,
    )?;
    Menu::with_items(app, &[&open_item, &toggle_pause_item, &quit_item])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::schema as db_schema;
    use sqlx::{Executor, SqlitePool};

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        pool.execute(db_schema::CURRENT_BASELINE_SCHEMA_SQL)
            .await
            .unwrap();
        pool
    }

    #[test]
    fn toggle_tracking_paused_in_pool_flips_setting_and_reason() {
        tauri::async_runtime::block_on(async {
            let pool = setup_test_db().await;

            let (first_paused, first_reason) = toggle_tracking_paused_in_pool(&pool).await.unwrap();
            let first_value = tracker_settings::load_tracking_paused_setting(&pool)
                .await
                .unwrap();
            let (second_paused, second_reason) =
                toggle_tracking_paused_in_pool(&pool).await.unwrap();
            let second_value = tracker_settings::load_tracking_paused_setting(&pool)
                .await
                .unwrap();

            assert_eq!(first_reason, "tracking-paused");
            assert!(first_paused);
            assert!(first_value);
            assert_eq!(second_reason, "tracking-resumed");
            assert!(!second_paused);
            assert!(!second_value);
        });
    }

    #[test]
    fn tracking_pause_menu_label_matches_next_available_action() {
        assert_eq!(tracking_pause_menu_label(false), "暂停追踪");
        assert_eq!(tracking_pause_menu_label(true), "恢复追踪");
    }

    #[test]
    fn explicit_exit_bypasses_close_to_tray_redirect() {
        let settings =
            DesktopBehaviorSettings::default().with_raw_desktop_behavior("tray", "taskbar");

        assert!(should_redirect_close_to_tray(settings, false));
        assert!(!should_redirect_close_to_tray(settings, true));
    }
}
