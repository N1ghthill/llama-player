use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
struct GoogleOAuthResult {
    code: String,
    redirect_uri: String,
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
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Abre o navegador padrão para OAuth do Google e recebe o callback em loopback.
#[tauri::command]
async fn google_oauth_authorize(
    app: tauri::AppHandle,
    client_id: String,
    scope: String,
    code_challenge: String,
    state: String,
) -> Result<GoogleOAuthResult, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|e| format!("Erro ao iniciar callback OAuth local: {}", e))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Erro ao configurar callback OAuth local: {}", e))?;

    let redirect_uri = format!(
        "http://127.0.0.1:{}",
        listener
            .local_addr()
            .map_err(|e| format!("Erro ao obter porta OAuth local: {}", e))?
            .port()
    );

    let auth_url =
        build_google_oauth_url(&client_id, &scope, &redirect_uri, &code_challenge, &state);

    #[allow(deprecated)]
    app.shell()
        .open(auth_url, None)
        .map_err(|e| format!("Erro ao abrir navegador para login Google: {}", e))?;

    let expected_state = state.clone();
    let redirect_uri_for_wait = redirect_uri.clone();
    let code = tauri::async_runtime::spawn_blocking(move || {
        wait_for_google_oauth_callback(listener, &expected_state)
    })
    .await
    .map_err(|e| format!("Erro ao aguardar callback OAuth: {}", e))??;

    Ok(GoogleOAuthResult {
        code,
        redirect_uri: redirect_uri_for_wait,
    })
}

fn build_google_oauth_url(
    client_id: &str,
    scope: &str,
    redirect_uri: &str,
    code_challenge: &str,
    state: &str,
) -> String {
    let query = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", scope)
        .append_pair("code_challenge", code_challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("state", state)
        .finish();

    format!("https://accounts.google.com/o/oauth2/v2/auth?{}", query)
}

fn wait_for_google_oauth_callback(
    listener: TcpListener,
    expected_state: &str,
) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(300);

    while Instant::now() < deadline {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buffer = [0_u8; 8192];
                let size = stream
                    .read(&mut buffer)
                    .map_err(|e| format!("Erro ao ler callback OAuth: {}", e))?;
                let request = String::from_utf8_lossy(&buffer[..size]);
                let Some(target) = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                else {
                    write_oauth_response(&mut stream, false, "Callback OAuth inválido");
                    continue;
                };

                let params = parse_query_params(target);

                if let Some(error) = params.get("error") {
                    let message = params
                        .get("error_description")
                        .map(String::as_str)
                        .unwrap_or(error);
                    write_oauth_response(&mut stream, false, message);
                    return Err(format!("Login Google cancelado ou recusado: {}", message));
                }

                if params.get("state").map(String::as_str) != Some(expected_state) {
                    write_oauth_response(&mut stream, false, "Estado OAuth inválido");
                    return Err("Callback OAuth rejeitado por state inválido".to_string());
                }

                if let Some(code) = params.get("code") {
                    write_oauth_response(
                        &mut stream,
                        true,
                        "Login concluído. Você já pode voltar ao Llama Player.",
                    );
                    return Ok(code.to_string());
                }

                write_oauth_response(&mut stream, false, "Código OAuth não recebido");
                return Err("Callback OAuth sem código de autorização".to_string());
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(err) => return Err(format!("Erro no callback OAuth local: {}", err)),
        }
    }

    Err("Tempo esgotado aguardando login Google".to_string())
}

fn parse_query_params(target: &str) -> HashMap<String, String> {
    let query = target.split_once('?').map(|(_, query)| query).unwrap_or("");
    url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect()
}

fn write_oauth_response(stream: &mut std::net::TcpStream, success: bool, message: &str) {
    let title = if success {
        "Login concluído"
    } else {
        "Falha no login"
    };
    let status = if success { "200 OK" } else { "400 Bad Request" };
    let escaped_message = message
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    let body = format!(
        r#"<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <style>
      body {{
        background: #111;
        color: #f5f5f5;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }}
      main {{
        max-width: 560px;
        padding: 32px;
        text-align: center;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <p>{escaped_message}</p>
    </main>
  </body>
</html>"#
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

/// Envia requests ao token endpoint do Google pelo backend nativo, evitando CORS da WebView.
#[tauri::command]
async fn google_oauth_token_request(
    params: HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let response = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Erro ao chamar token endpoint do Google: {}", e))?;

    let status = response.status();
    let data = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Erro ao ler resposta OAuth do Google: {}", e))?;

    if !status.is_success() {
        let message = data
            .get("error_description")
            .or_else(|| data.get("error"))
            .and_then(|value| value.as_str())
            .unwrap_or("Erro OAuth do Google");
        return Err(message.to_string());
    }

    Ok(data)
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
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

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
        .invoke_handler(tauri::generate_handler![
            get_music_dir,
            get_system_info,
            google_oauth_authorize,
            google_oauth_token_request
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao executar o Llama Player");
}
