use std::path::Path;
use tauri::Manager;

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus"];
const MAX_AUDIO_FILE_BYTES: u64 = 512 * 1024 * 1024;

fn is_supported_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Varre um diretório recursivamente em busca de arquivos de áudio.
/// Retorna uma lista de caminhos absolutos.
#[tauri::command]
fn scan_audio_dir(path: String) -> Result<Vec<String>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Caminho não é um diretório: {}", path));
    }

    let mut results = Vec::new();
    scan_dir_recursive(dir, &mut results).map_err(|e| format!("Erro ao varrer diretório: {}", e))?;
    Ok(results)
}

fn scan_dir_recursive(dir: &Path, results: &mut Vec<String>) -> std::io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Skip hidden directories
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }
            scan_dir_recursive(&path, results)?;
        } else if path.is_file() {
            if is_supported_audio_file(&path) {
                results.push(path.to_string_lossy().to_string());
            }
        }
    }

    Ok(())
}

/// Le um arquivo de audio local escolhido pelo usuario.
/// O comando valida extensao e tamanho antes de retornar bytes ao frontend.
#[tauri::command]
fn read_audio_file(path: String) -> Result<Vec<u8>, String> {
    let file_path = Path::new(&path);

    if !file_path.is_file() {
        return Err(format!("Caminho nao e um arquivo: {}", path));
    }

    if !is_supported_audio_file(file_path) {
        return Err(format!("Extensao de audio nao suportada: {}", path));
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("Erro ao ler metadados do arquivo: {}", e))?;
    if metadata.len() > MAX_AUDIO_FILE_BYTES {
        return Err(format!(
            "Arquivo muito grande para reproducao segura: {} MB",
            metadata.len() / 1024 / 1024
        ));
    }

    std::fs::read(file_path).map_err(|e| format!("Erro ao ler arquivo de audio: {}", e))
}

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
    // Use the hostname crate via std::process::Command as fallback
    // Priority: env vars (cross-platform), /etc/hostname (Linux), hostname command
    if let Ok(host) = std::env::var("HOSTNAME") {
        return host;
    }
    if let Ok(host) = std::env::var("COMPUTERNAME") {
        return host;
    }
    if let Ok(content) = std::fs::read_to_string("/etc/hostname") {
        let trimmed = content.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    // Fallback: call hostname command (works on Linux, macOS, Windows with MSYS)
    if let Ok(output) = std::process::Command::new("hostname").output() {
        if output.status.success() {
            if let Ok(host) = String::from_utf8(output.stdout) {
                let trimmed = host.trim().to_string();
                if !trimmed.is_empty() {
                    return trimmed;
                }
            }
        }
    }
    "unknown".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            get_system_info,
            read_audio_file,
            scan_audio_dir
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar o Llama Player");
}
