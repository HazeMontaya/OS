use std::sync::Mutex;

use os_contracts::SystemSnapshot;
use os_kernel::Kernel;
use tauri::Manager;

struct AppState {
    kernel: Mutex<Kernel>,
}

#[tauri::command]
fn system_snapshot(state: tauri::State<'_, AppState>) -> SystemSnapshot {
    state
        .kernel
        .lock()
        .expect("kernel lock poisoned")
        .snapshot()
}

#[tauri::command]
fn ingest_event(content: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state
        .kernel
        .lock()
        .map_err(|_| "kernel lock poisoned".to_string())?
        .ingest_user_input(content)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?.join("cognition");
            let database_path = data_dir.join("os.sqlite3");
            let kernel = Kernel::open(database_path)?;

            app.manage(AppState {
                kernel: Mutex::new(kernel),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![system_snapshot, ingest_event])
        .run(tauri::generate_context!())
        .expect("error while running OS");
}
