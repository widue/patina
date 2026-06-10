use tauri::{Runtime, WebviewWindow};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, IsIconic, IsWindow, SetForegroundWindow, SetWindowPos, ShowWindow,
    ShowWindowAsync, HWND_TOP, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_RESTORE, SW_SHOW,
};

pub(crate) fn restore_to_foreground<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    let hwnd = native_hwnd(window)?;

    unsafe {
        if hwnd.0.is_null() || !IsWindow(Some(hwnd)).as_bool() {
            return Err("window handle is no longer valid".to_string());
        }

        let show_command = if IsIconic(hwnd).as_bool() {
            SW_RESTORE
        } else {
            SW_SHOW
        };

        let _ = ShowWindowAsync(hwnd, show_command);
        let _ = ShowWindow(hwnd, show_command);

        SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
        )
        .map_err(|error| format!("failed to bring window to top: {error}"))?;

        if !SetForegroundWindow(hwnd).as_bool() {
            BringWindowToTop(hwnd)
                .map_err(|error| format!("failed to bring window to foreground: {error}"))?;
        }
    }

    Ok(())
}

fn native_hwnd<R: Runtime>(window: &WebviewWindow<R>) -> Result<HWND, String> {
    let hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to read native window handle: {error}"))?;

    Ok(HWND(hwnd.0.cast()))
}
