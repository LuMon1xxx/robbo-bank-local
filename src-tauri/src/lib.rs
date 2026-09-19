#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_fs::init())
    // Updater ОТКЛЮЧЁН: tauri-plugin-updater требует поле plugins.updater.pubkey
    // в tauri.conf.json даже при active:false — без него приложение падает
    // с exit 101 (PluginInitialization "missing field `pubkey`").
    // Включать только вместе с ключом: см. src/lib/updater.ts (шаги 1–4).
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
