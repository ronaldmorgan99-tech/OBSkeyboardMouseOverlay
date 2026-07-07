use tauri::{Manager, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyO);
                let shortcut_for_handler = shortcut.clone();

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app_handle, registered_shortcut, event| {
                            if registered_shortcut != &shortcut_for_handler
                                || event.state() != ShortcutState::Pressed
                            {
                                return;
                            }

                            if let Some(window) = app_handle.get_webview_window("main") {
                                toggle_window_visibility(&window);
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(shortcut)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window_visibility(window: &WebviewWindow) {
    let visible = matches!(window.is_visible(), Ok(true));

    if visible {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
