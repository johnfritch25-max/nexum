// process_scanner.rs
// Detects the active foreground application and returns its name + window title.

#[cfg(target_os = "windows")]
use std::ffi::OsString;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;

#[cfg(target_os = "windows")]
use windows::{
    Win32::Foundation::MAX_PATH,
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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ActiveProcessInfo {
    pub process_name: String,
    pub window_title: String,
}

// ── Windows ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        // HWND is a wrapper around *mut c_void — check if null
        if hwnd.0.is_null() {
            return Err("No foreground window.".to_string());
        }

        // Window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let window_title = if title_len > 0 {
            OsString::from_wide(&title_buf[..title_len as usize])
                .to_string_lossy()
                .into_owned()
        } else {
            String::new()
        };

        // Process ID
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return Err("Could not get process ID.".to_string());
        }

        // Open process
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .map_err(|e| format!("OpenProcess: {e}"))?;

        // Get executable path
        let mut path_buf = [0u16; MAX_PATH as usize];
        let mut path_len = MAX_PATH;
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(path_buf.as_mut_ptr()),
            &mut path_len,
        )
        .map_err(|e| format!("QueryFullProcessImageNameW: {e}"))?;

        let full_path = OsString::from_wide(&path_buf[..path_len as usize])
            .to_string_lossy()
            .into_owned();

        let process_name = std::path::Path::new(&full_path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or(full_path);

        Ok(ActiveProcessInfo { process_name, window_title })
    }
}

// ── macOS ─────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    let script = r#"tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        set frontWin to ""
        try
            set frontWin to name of front window of application process frontApp
        end try
        return frontApp & "|" & frontWin
    end tell"#;

    let out = Command::new("osascript")
        .arg("-e").arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let parts: Vec<&str> = raw.splitn(2, '|').collect();
    Ok(ActiveProcessInfo {
        process_name: parts.first().unwrap_or(&"").trim().to_string(),
        window_title: parts.get(1).unwrap_or(&"").trim().to_string(),
    })
}

// ── Fallback ──────────────────────────────────────────────────────────────────

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
#[tauri::command]
pub fn get_active_process() -> Result<ActiveProcessInfo, String> {
    Err("Not supported on this platform.".to_string())
}
