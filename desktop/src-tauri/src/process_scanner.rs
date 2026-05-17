// process_scanner.rs
//
// Tauri command that detects the active foreground application on Windows/macOS
// and returns its process name and window title to the TypeScript frontend.
//
// Register in main.rs:
//   .invoke_handler(tauri::generate_handler![process_scanner::get_active_process])

use std::collections::HashMap;

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;

#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::{HWND, MAX_PATH},
    Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    },
    Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    },
};

#[cfg(target_os = "macos")]
use std::process::Command;

/// Payload returned to the TypeScript frontend via Tauri's invoke() bridge.
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ActiveProcessInfo {
    /// Raw executable name, e.g. "Code.exe" or "Minecraft Launcher"
    pub process_name: String,
    /// Window title of the foreground application
    pub window_title: String,
}

// ── Windows implementation ───────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0 == 0 {
            return Err("No foreground window found.".to_string());
        }

        // Get window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = if title_len > 0 {
            OsString::from_wide(&title_buf[..title_len as usize])
                .to_string_lossy()
                .into_owned()
        } else {
            String::new()
        };

        // Get process ID from window handle
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return Err("Could not retrieve process ID.".to_string());
        }

        // Open process handle with minimal required rights
        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .map_err(|e| format!("OpenProcess failed: {e}"))?;

        // Query the full executable path
        let mut path_buf = [0u16; MAX_PATH as usize];
        let mut path_len = MAX_PATH;
        QueryFullProcessImageNameW(
            process_handle,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(path_buf.as_mut_ptr()),
            &mut path_len,
        )
        .map_err(|e| format!("QueryFullProcessImageNameW failed: {e}"))?;

        let full_path = OsString::from_wide(&path_buf[..path_len as usize])
            .to_string_lossy()
            .into_owned();

        // Extract just the filename e.g. "Code.exe"
        let process_name = std::path::Path::new(&full_path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or(full_path);

        Ok(ActiveProcessInfo { process_name, window_title })
    }
}

// ── macOS implementation ─────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    let script = r#"
        tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
            set frontAppWindow to ""
            try
                set frontAppWindow to name of front window of application process frontApp
            end try
            return frontApp & "|" & frontAppWindow
        end tell
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("osascript execution failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("osascript error: {stderr}"));
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = raw.splitn(2, '|').collect();

    let process_name = parts.first().unwrap_or(&"").trim().to_string();
    let window_title = parts.get(1).unwrap_or(&"").trim().to_string();

    if process_name.is_empty() {
        return Err("Could not determine active application.".to_string());
    }

    Ok(ActiveProcessInfo { process_name, window_title })
}

// ── Fallback ─────────────────────────────────────────────────────────────────

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    Err("Process scanning is not supported on this platform.".to_string())
}
