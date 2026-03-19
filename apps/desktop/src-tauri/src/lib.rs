use serde::Serialize;

#[derive(Serialize)]
struct DesktopHealth {
    platform: &'static str,
    shell: &'static str,
}

#[tauri::command]
fn desktop_health() -> DesktopHealth {
    DesktopHealth {
        platform: "macOS-first",
        shell: "tauri",
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![desktop_health])
        .run(tauri::generate_context!())
        .expect("failed to run Orbital desktop shell");
}
