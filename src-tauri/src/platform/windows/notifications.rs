use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{AppHandle, Runtime};
use url::Url;
use windows::core::{HSTRING, IInspectable, Interface, PCWSTR, Ref};
use windows::Data::Xml::Dom::XmlDocument;
use windows::Foundation::TypedEventHandler;
use windows::UI::Notifications::{
    ToastActivatedEventArgs, ToastNotification, ToastNotificationManager,
};
use windows::Win32::Foundation::{ERROR_SUCCESS, WIN32_ERROR};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_WRITE,
    REG_OPTION_NON_VOLATILE, REG_DWORD, REG_SZ,
};

#[derive(Clone, Copy)]
#[expect(dead_code)]
pub enum Duration {
    Short,
    Long,
}

#[derive(Clone, Copy)]
#[expect(dead_code)]
pub enum Scenario {
    Default,
    Alarm,
    Reminder,
    IncomingCall,
}

pub struct ToastButton {
    pub label: String,
    pub action: String,
}

pub struct ToastOptions {
    pub app_id: String,
    pub title: String,
    pub body: String,
    pub scenario: Scenario,
    pub duration: Duration,
    pub buttons: Vec<ToastButton>,
    pub icon_path: Option<PathBuf>,
}

static INIT_ONCE: std::sync::Once = std::sync::Once::new();
static EMBEDDED_ICON_PATH: OnceLock<PathBuf> = OnceLock::new();

const EMBEDDED_ICON_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/icons/icon.png"
));

pub fn initialize(app_id: &str, app_name: &str) -> Result<(), String> {
    let mut result = Ok(());
    INIT_ONCE.call_once(|| {
        if let Err(error) = set_process_app_user_model_id(app_id) {
            result = Err(error);
            return;
        }
        write_embedded_icon();
        if let Err(error) = register_app_user_model_id(app_id, app_name) {
            result = Err(error);
        }
    });
    result
}

fn write_embedded_icon() -> Option<PathBuf> {
    if let Some(path) = EMBEDDED_ICON_PATH.get() {
        return Some(path.clone());
    }

    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let icon_path = exe_dir.join("patina-notification-icon.png");

    if !icon_path.exists() {
        std::fs::write(&icon_path, EMBEDDED_ICON_BYTES).ok()?;
    }

    let _ = EMBEDDED_ICON_PATH.set(icon_path.clone());
    Some(icon_path)
}

fn set_process_app_user_model_id(app_id: &str) -> Result<(), String> {
    use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let app_id_hstring = HSTRING::from(app_id);
    unsafe { SetCurrentProcessExplicitAppUserModelID(&app_id_hstring) }
        .map_err(|error| format!("set process AppUserModelID failed: {error}"))
}

pub fn send<R, F>(
    app: &AppHandle<R>,
    options: ToastOptions,
    on_action: F,
) -> Result<(), String>
where
    R: Runtime + 'static,
    F: Fn(String) -> Result<(), String> + Send + 'static,
{
    let icon_path = options.icon_path.or_else(write_embedded_icon);
    let icon_xml = build_icon_xml(&icon_path);

    let mut attrs = match options.duration {
        Duration::Long => r#"duration="long""#.to_string(),
        Duration::Short => r#"duration="short""#.to_string(),
    };
    match options.scenario {
        Scenario::Default => {}
        Scenario::Alarm => attrs.push_str(r#" scenario="alarm""#),
        Scenario::Reminder => attrs.push_str(r#" scenario="reminder""#),
        Scenario::IncomingCall => attrs.push_str(r#" scenario="incomingCall""#),
    }

    let title_escaped = xml_escape(&options.title);
    let body_escaped = xml_escape(&options.body);

    let mut actions = String::new();
    if !options.buttons.is_empty() {
        actions.push_str("<actions>");
        for btn in &options.buttons {
            actions.push_str(&format!(
                r#"<action content="{}" arguments="{}"/>"#,
                xml_escape(&btn.label),
                xml_escape(&btn.action)
            ));
        }
        actions.push_str("</actions>");
    }

    let xml_str = format!(
        r#"<toast {}><visual><binding template="ToastGeneric">{}<text id="1">{}</text><text id="2">{}</text></binding></visual>{}</toast>"#,
        attrs, icon_xml, title_escaped, body_escaped, actions
    );

    let doc =
        XmlDocument::new().map_err(|e| format!("XmlDocument::new failed: {e}"))?;
    doc.LoadXml(&HSTRING::from(&xml_str))
        .map_err(|e| format!("LoadXml failed: {e}"))?;

    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
        &options.app_id,
    ))
    .map_err(|e| format!("CreateToastNotifierWithId failed: {e}"))?;

    let notification = ToastNotification::CreateToastNotification(&doc)
        .map_err(|e| format!("CreateToastNotification failed: {e}"))?;

    let handle = app.clone();
    let handler = TypedEventHandler::new(
        move |_: Ref<ToastNotification>,
              args: Ref<IInspectable>|
              -> windows::core::Result<()> {
            if let Some(inspectable) = args.as_ref() {
                if let Ok(event_args) = inspectable.cast::<ToastActivatedEventArgs>() {
                    let action = event_args
                        .Arguments()
                        .map(|h| h.to_string())
                        .unwrap_or_default();

                    if action.is_empty() {
                        crate::app::main_window::show_main_window(&handle);
                    } else {
                        let _ = on_action(action);
                    }
                }
            }
            Ok(())
        },
    );
    notification
        .Activated(&handler)
        .map_err(|e| format!("Activated failed: {e}"))?;

    notifier
        .Show(&notification)
        .map_err(|e| format!("Show failed: {e}"))?;

    Ok(())
}

fn build_icon_xml(icon_path: &Option<PathBuf>) -> String {
    match icon_path {
        Some(path) if path.exists() => match Url::from_file_path(path) {
            Ok(url) => format!(
                r#"<image placement="appLogoOverride" src="{}" alt=""/>"#,
                xml_escape(url.as_str())
            ),
            Err(_) => String::new(),
        },
        _ => String::new(),
    }
}

fn register_app_user_model_id(app_id: &str, app_name: &str) -> Result<(), String> {
    let subkey = HSTRING::from(format!(r"SOFTWARE\Classes\AppUserModelId\{app_id}"));
    let mut key = HKEY::default();

    let result = unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            &subkey,
            None,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut key,
            None,
        )
    };
    check_win32(result, "create notification app identity registry key")?;

    let set_result = (|| {
        set_string_value(key, "DisplayName", app_name)?;

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_str) = exe_path.to_str() {
                set_string_value(key, "ExePath", exe_str)?;
            }
        }
        set_dword_value(key, "ShowInSettings", 1)?;
        Ok(())
    })();

    let close_result = unsafe { RegCloseKey(key) };
    check_win32(close_result, "close notification app identity registry key")?;

    set_result
}

fn set_string_value(key: HKEY, name: &str, value: &str) -> Result<(), String> {
    let value_name = HSTRING::from(name);
    let bytes = reg_sz_bytes(value);
    let result = unsafe { RegSetValueExW(key, &value_name, None, REG_SZ, Some(&bytes)) };
    check_win32(result, "set notification app identity registry value")
}

fn set_dword_value(key: HKEY, name: &str, value: u32) -> Result<(), String> {
    let value_name = HSTRING::from(name);
    let bytes = value.to_le_bytes();
    let result = unsafe { RegSetValueExW(key, &value_name, None, REG_DWORD, Some(&bytes)) };
    check_win32(result, "set notification app identity registry dword value")
}

fn reg_sz_bytes(value: &str) -> Vec<u8> {
    value
        .encode_utf16()
        .chain(std::iter::once(0))
        .flat_map(u16::to_le_bytes)
        .collect()
}

fn check_win32(result: WIN32_ERROR, action: &str) -> Result<(), String> {
    if result == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!("{action} failed with code {}", result.0))
    }
}

fn xml_escape(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => result.push_str("&amp;"),
            '<' => result.push_str("&lt;"),
            '>' => result.push_str("&gt;"),
            '"' => result.push_str("&quot;"),
            '\'' => result.push_str("&apos;"),
            _ => result.push(c),
        }
    }
    result
}
