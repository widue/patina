use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::{
    ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND, ERROR_SUCCESS, WIN32_ERROR,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegGetValueW, RegOpenKeyExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SZ,
    RRF_RT_REG_SZ,
};

const LEGACY_AUTOSTART_VALUE_NAMES: &[&str] = &["Time Tracker", "time_tracker", "TimeTracker"];
const AUTOSTART_RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const STARTUP_APPROVED_RUN_KEY: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
const PATINA_PRODUCT_KEY: &str = r"Software\timetracker\Patina";
const CLEANUP_MARKER_VALUE: &str = "LegacyTimeTrackerCleanupCompleted";

pub fn cleanup_legacy_time_tracker_autostart_entries() {
    if cleanup_marker_exists() {
        return;
    }

    let mut cleanup_succeeded = true;
    for subkey in [AUTOSTART_RUN_KEY, STARTUP_APPROVED_RUN_KEY] {
        for value_name in LEGACY_AUTOSTART_VALUE_NAMES {
            if let Err(error) = delete_registry_value(HKEY_CURRENT_USER, subkey, value_name) {
                cleanup_succeeded = false;
                eprintln!(
                    "[startup] failed to remove legacy Time Tracker autostart value: {error}"
                );
            }
        }
    }

    if cleanup_succeeded {
        if let Err(error) = write_cleanup_marker() {
            eprintln!("[startup] failed to mark legacy Time Tracker cleanup complete: {error}");
        }
    }
}

fn delete_registry_value(root: HKEY, subkey: &str, value_name: &str) -> Result<(), String> {
    let key = match open_registry_key_for_write(root, subkey)? {
        Some(key) => key,
        None => return Ok(()),
    };

    let value_name = HSTRING::from(value_name);
    let result = unsafe { RegDeleteValueW(key.raw(), &value_name) };
    if is_missing(result) || result == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!(
            r#"delete "{subkey}\{}" failed with code {}"#,
            value_name.to_string_lossy(),
            result.0
        ))
    }
}

fn open_registry_key_for_write(root: HKEY, subkey: &str) -> Result<Option<RegistryKey>, String> {
    let subkey = HSTRING::from(subkey);
    let mut key = HKEY::default();
    let result = unsafe { RegOpenKeyExW(root, &subkey, None, KEY_SET_VALUE, &mut key) };

    if result == ERROR_SUCCESS {
        Ok(Some(RegistryKey(key)))
    } else if is_missing(result) {
        Ok(None)
    } else {
        Err(format!(
            r#"open "{}" failed with code {}"#,
            subkey.to_string_lossy(),
            result.0
        ))
    }
}

fn cleanup_marker_exists() -> bool {
    let subkey = HSTRING::from(PATINA_PRODUCT_KEY);
    let value_name = HSTRING::from(CLEANUP_MARKER_VALUE);
    let mut buffer = [0u16; 8];
    let mut buffer_len = (buffer.len() * std::mem::size_of::<u16>()) as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            &subkey,
            &value_name,
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut buffer_len),
        )
    };

    result == ERROR_SUCCESS
}

fn write_cleanup_marker() -> Result<(), String> {
    let key = create_registry_key_for_write(HKEY_CURRENT_USER, PATINA_PRODUCT_KEY)?;
    set_string_value(key.raw(), CLEANUP_MARKER_VALUE, "1")
}

fn create_registry_key_for_write(root: HKEY, subkey: &str) -> Result<RegistryKey, String> {
    let subkey = HSTRING::from(subkey);
    let mut key = HKEY::default();
    let result = unsafe {
        RegCreateKeyExW(
            root,
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

    if result == ERROR_SUCCESS {
        Ok(RegistryKey(key))
    } else {
        Err(format!(
            r#"create "{}" failed with code {}"#,
            subkey.to_string_lossy(),
            result.0
        ))
    }
}

fn set_string_value(key: HKEY, name: &str, value: &str) -> Result<(), String> {
    let value_name = HSTRING::from(name);
    let bytes = reg_sz_bytes(value);
    let result = unsafe { RegSetValueExW(key, &value_name, None, REG_SZ, Some(&bytes)) };
    if result == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(format!(
            r#"set "{}" failed with code {}"#,
            value_name.to_string_lossy(),
            result.0
        ))
    }
}

fn reg_sz_bytes(value: &str) -> Vec<u8> {
    value
        .encode_utf16()
        .chain(std::iter::once(0))
        .flat_map(u16::to_le_bytes)
        .collect()
}

fn is_missing(result: WIN32_ERROR) -> bool {
    result == ERROR_FILE_NOT_FOUND || result == ERROR_PATH_NOT_FOUND
}

struct RegistryKey(HKEY);

impl RegistryKey {
    fn raw(&self) -> HKEY {
        self.0
    }
}

impl Drop for RegistryKey {
    fn drop(&mut self) {
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}
