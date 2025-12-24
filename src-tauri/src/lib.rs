use tauri::command;
use cpal::traits::{HostTrait, DeviceTrait};

#[derive(serde::Serialize)]
struct AudioDevice {
    name: String,
    device_type: String,
}

#[command]
fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices_list = Vec::new();

    // disp saida
    if let Ok(outputs) = host.output_devices() {
        for device in outputs {
            if let Ok(name) = device.name() {
                devices_list.push(AudioDevice {
                    name,
                    device_type: "Output".to_string(),
                });
            }
        }
    }

    // disp entrada
    if let Ok(inputs) = host.input_devices() {
        for device in inputs {
            if let Ok(name) = device.name() {
                devices_list.push(AudioDevice {
                    name,
                    device_type: "Input".to_string(),
                });
            }
        }
    }

    Ok(devices_list)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_audio_devices])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}