use tauri::Manager;

/// Comando para obter o caminho do diretório de músicas do usuário
#[tauri::command]
fn get_music_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .audio_dir()
        .map_err(|e| format!("Erro ao obter diretório de áudio: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// Comando para obter informações do sistema
#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hostname": hostname(),
    })
}

fn hostname() -> String {
    // Try multiple sources for hostname
    if let Ok(host) = std::env::var("HOSTNAME") {
        return host;
    }
    if let Ok(host) = std::env::var("COMPUTERNAME") {
        return host;
    }
    // Try reading /etc/hostname on Linux
    if let Ok(content) = std::fs::read_to_string("/etc/hostname") {
        return content.trim().to_string();
    }
    "unknown".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            log::info!("🦙 Llama Player iniciado");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_music_dir,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar o Llama Player");
}
