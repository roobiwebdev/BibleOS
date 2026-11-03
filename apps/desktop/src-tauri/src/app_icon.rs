//! Dock icon that follows the app theme while BibleOS runs.
//!
//! macOS shows the bundled icon (sepia) whenever the app is not running; while it runs,
//! NSApplication's icon image can be replaced. The images are compiled into the binary,
//! and only the three known theme names are accepted.

use tauri::AppHandle;

fn icon_bytes(theme: &str) -> Option<&'static [u8]> {
    match theme {
        "paper" => Some(include_bytes!("../icons/theme/paper.png")),
        "sepia" => Some(include_bytes!("../icons/theme/sepia.png")),
        "night" => Some(include_bytes!("../icons/theme/night.png")),
        _ => None,
    }
}

#[tauri::command]
pub fn set_app_icon(app: AppHandle, theme: String) -> Result<(), String> {
    let bytes = icon_bytes(&theme).ok_or("unknown theme")?;
    #[cfg(target_os = "macos")]
    {
        app.run_on_main_thread(move || {
            use objc2::AllocAnyThread;
            use objc2::MainThreadMarker;
            use objc2_app_kit::{NSApplication, NSImage};
            use objc2_foundation::NSData;

            let Some(mtm) = MainThreadMarker::new() else { return };
            let data = NSData::with_bytes(bytes);
            if let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) {
                let app = NSApplication::sharedApplication(mtm);
                unsafe { app.setApplicationIconImage(Some(&image)) };
            }
        })
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, bytes);
    }
    Ok(())
}
