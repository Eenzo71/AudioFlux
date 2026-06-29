use tauri::command;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::HeapRb;
use serde::{Deserialize, Serialize};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Mutex, OnceLock};
use std::thread;

#[derive(serde::Serialize)]
struct AudioDevice {
    name: String,
    device_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioRoute {
    pub source_name: String,
    pub target_name: String,
}

static AUDIO_COMMAND_SENDER: OnceLock<Mutex<Sender<Vec<AudioRoute>>>> = OnceLock::new();

fn init_audio_thread() {
    let (tx, rx) = channel::<Vec<AudioRoute>>();
    AUDIO_COMMAND_SENDER.set(Mutex::new(tx)).unwrap();

    thread::spawn(move || {
        let mut active_streams: Vec<cpal::Stream> = Vec::new();

        while let Ok(routes) = rx.recv() {
            active_streams.clear(); 

            for route in routes {
                println!("🔌 Iniciando rota: [{}] ---> [{}]", route.source_name, route.target_name);
                
                match create_audio_streams(&route.source_name, &route.target_name) {
                    Ok((in_stream, out_stream)) => {
                        active_streams.push(in_stream);
                        active_streams.push(out_stream);
                        println!("✅ Rota conectada com sucesso!");
                    }
                    Err(e) => println!("❌ Erro na rota: {}", e),
                }
            }
        }
    });
}

fn create_audio_streams(input_name: &str, output_name: &str) -> Result<(cpal::Stream, cpal::Stream), String> {
    let host = cpal::default_host();
    
    let input_device = host.input_devices()
        .map_err(|e| e.to_string())?
        .find(|x| x.name().unwrap_or_default() == input_name)
        .ok_or_else(|| format!("Entrada '{}' não encontrada.", input_name))?;

    let output_device = host.output_devices()
        .map_err(|e| e.to_string())?
        .find(|x| x.name().unwrap_or_default() == output_name)
        .ok_or_else(|| format!("Saída '{}' não encontrada.", output_name))?;

    let in_config = input_device.default_input_config().map_err(|e| e.to_string())?;
    let out_config = output_device.default_output_config().map_err(|e| e.to_string())?;

    let rb = HeapRb::<f32>::new(8192);
    let (mut producer, mut consumer) = rb.split();

    let input_stream = input_device.build_input_stream(
        &in_config.config(),
        move |data: &[f32], _| {
            for &sample in data {
                let _ = producer.push(sample);
            }
        },
        |err| eprintln!("Erro na captura: {}", err),
        None
    ).map_err(|e| e.to_string())?;

    let output_stream = output_device.build_output_stream(
        &out_config.config(),
        move |data: &mut [f32], _| {
            for sample in data.iter_mut() {
                *sample = consumer.pop().unwrap_or(0.0);
            }
        },
        |err| eprintln!("Erro na reprodução: {}", err),
        None
    ).map_err(|e| e.to_string())?;

    input_stream.play().map_err(|e| e.to_string())?;
    output_stream.play().map_err(|e| e.to_string())?;

    Ok((input_stream, output_stream)) 
}

#[command]
fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices_list = Vec::new();

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

#[command]
fn get_audio_apps() -> Result<Vec<AudioDevice>, String> {
    let mut apps: Vec<AudioDevice> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Com::{CoInitializeEx, CoCreateInstance, COINIT_MULTITHREADED, CLSCTX_ALL};
        use windows::Win32::Media::Audio::{
            eRender, eConsole, IMMDeviceEnumerator, MMDeviceEnumerator, IAudioSessionManager2, IAudioSessionControl2
        };
        use windows::core::Interface; 
        use sysinfo::System;

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

            if let Ok(enumerator) = CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
                    if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
                        if let Ok(session_enumerator) = session_manager.GetSessionEnumerator() {
                            if let Ok(count) = session_enumerator.GetCount() {
                                
                                let mut sys = System::new_all();
                                sys.refresh_processes();

                                for i in 0..count {
                                    if let Ok(session) = session_enumerator.GetSession(i) {
                                        if let Ok(session_ctrl2) = session.cast::<IAudioSessionControl2>() {
                                            if let Ok(pid) = session_ctrl2.GetProcessId() {
                                                if pid != 0 {
                                                    if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
                                                        let exe_name = process.name().to_string();
                                                        
                                                        if !apps.iter().any(|a| a.name == exe_name) {
                                                            apps.push(AudioDevice {
                                                                name: exe_name,
                                                                device_type: "Application".to_string(),
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if apps.is_empty() {
        apps.push(AudioDevice {
            name: "Nenhum App ativo".to_string(),
            device_type: "Application".to_string(),
        });
    }

    Ok(apps)
}

#[command]
fn apply_routes(routes: Vec<AudioRoute>) {
    if let Some(mutex) = AUDIO_COMMAND_SENDER.get() {
        if let Ok(sender) = mutex.lock() {
            let _ = sender.send(routes);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_audio_thread();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_audio_devices, get_audio_apps, apply_routes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}