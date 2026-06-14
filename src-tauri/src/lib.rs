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
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
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

            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("Erro ao obter diretório de dados")
                .join("stronghold-salt.txt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Log de inicialização
            log::info!("🦙 Llama Player iniciado");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_music_dir, get_system_info])
        .run(tauri::generate_context!())
        .expect("Erro ao executar o Llama Player");
}
