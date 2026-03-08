use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use sysinfo::System;
use tauri::State;

struct AtomicF32(AtomicU32);
impl AtomicF32 {
    fn new(v: f32) -> Self { Self(AtomicU32::new(v.to_bits())) }
    fn load(&self) -> f32 { f32::from_bits(self.0.load(Ordering::Relaxed)) }
    fn store(&self, v: f32) { self.0.store(v.to_bits(), Ordering::Relaxed); }
}

#[derive(Serialize, Deserialize)]
struct AudioDevice {
    name: String,
    device_type: String,
}

enum AudioCommand {
    Connect {
        input_name: String,
        output_name: String,
        input_vol: Arc<AtomicF32>,
        output_vol: Arc<AtomicF32>,
    },
    Disconnect {
        input_name: String,
        output_name: String,
    },
}

struct AppState {
    tx: Mutex<mpsc::Sender<AudioCommand>>,
    volumes: Mutex<HashMap<String, Arc<AtomicF32>>>,
}

#[tauri::command]
fn get_audio_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let mut devices_list = Vec::new();

    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(name) = device.name() { 
                devices_list.push(AudioDevice { name, device_type: "Input".to_string() }); 
            }
        }
    }
    
    if let Ok(devices) = host.output_devices() {
        for device in devices {
            if let Ok(name) = device.name() { 
                devices_list.push(AudioDevice { name: name.clone(), device_type: "Output".to_string() }); 
                devices_list.push(AudioDevice { name: format!("[Sistema] {}", name), device_type: "Input".to_string() }); 
            }
        }
    }
    devices_list
}

#[tauri::command]
fn get_active_apps() -> Vec<String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    let mut apps = Vec::new();
    let media_apps = ["brave", "chrome", "firefox", "msedge", "spotify", "discord", "vlc"];

    for (_pid, process) in sys.processes() {
        let name = process.name().to_lowercase();
        for app in media_apps.iter() {
            if name == *app || name == format!("{}.exe", app) {
                let display_name = process.name().replace(".exe", "");
                if !apps.contains(&display_name) {
                    apps.push(display_name);
                }
            }
        }
    }
    apps
}

#[tauri::command]
fn set_device_volume(device_name: String, volume: f32, is_muted: bool, state: State<'_, AppState>) {
    let mut volumes = state.volumes.lock().unwrap();
    let vol_arc = volumes.entry(device_name).or_insert_with(|| Arc::new(AtomicF32::new(1.0)));
    let final_vol = if is_muted { 0.0 } else { volume / 100.0 };
    vol_arc.store(final_vol);
}

#[tauri::command]
fn connect_audio_stream(input_device: String, output_device: String, state: State<'_, AppState>) -> Result<String, String> {
    let mut volumes = state.volumes.lock().unwrap();
    let input_vol = volumes.entry(input_device.clone()).or_insert_with(|| Arc::new(AtomicF32::new(0.8))).clone();
    let output_vol = volumes.entry(output_device.clone()).or_insert_with(|| Arc::new(AtomicF32::new(0.8))).clone();
    
    let tx = state.tx.lock().unwrap();
    tx.send(AudioCommand::Connect {
        input_name: input_device.clone(),
        output_name: output_device.clone(),
        input_vol,
        output_vol,
    }).map_err(|e| format!("Erro ao enviar: {}", e))?;

    Ok("Ordem de ligação enviada!".to_string())
}

#[tauri::command]
fn disconnect_audio_stream(input_device: String, output_device: String, state: State<'_, AppState>) -> Result<String, String> {
    let tx = state.tx.lock().unwrap();
    tx.send(AudioCommand::Disconnect {
        input_name: input_device,
        output_name: output_device,
    }).map_err(|e| format!("Erro ao desconectar: {}", e))?;
    
    Ok("Ordem de corte enviada!".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    std::thread::spawn(move || {
        let mut active_connections: HashMap<String, (Option<cpal::Stream>, cpal::Stream)> = HashMap::new();

        while let Ok(command) = rx.recv() {
            match command {
                AudioCommand::Connect { input_name, output_name, input_vol, output_vol } => {
                    let conn_id = format!("{}==>{}", input_name, output_name);
                    let host = cpal::default_host();
                    
                    let is_app = input_name.starts_with("[App] ");
                    let is_loopback = input_name.starts_with("[Sistema] ");
                    
                    let out_device_opt = host.output_devices().ok().and_then(|mut iter| iter.find(|x| x.name().unwrap_or_default() == output_name));
                    let mut sample_rate = 48000;
                    if let Some(out_device) = &out_device_opt {
                        if let Ok(conf) = out_device.default_output_config() { sample_rate = conf.sample_rate().0; }
                    }

                    let (audio_tx, audio_rx) = mpsc::channel::<f32>();
                    let mut input_stream_opt = None;

                    if is_app {
                        let app_name = input_name.replace("[App] ", "");
                        let mut sys = System::new_all();
                        sys.refresh_all();
                        let mut target_pid = 0;
                        
                        // Busca o ID do Processo Pai (Aquele que não tem um pai com o mesmo nome)
                        for (pid, process) in sys.processes() {
                            let p_name = process.name().to_lowercase();
                            if p_name == app_name.to_lowercase() || p_name == format!("{}.exe", app_name.to_lowercase()) {
                                let mut is_root = true;
                                if let Some(parent_pid) = process.parent() {
                                    if let Some(parent_proc) = sys.process(parent_pid) {
                                        let parent_name = parent_proc.name().to_lowercase();
                                        if parent_name == app_name.to_lowercase() || parent_name == format!("{}.exe", app_name.to_lowercase()) {
                                            is_root = false; // Tem um pai com o mesmo nome, então ele é filho
                                        }
                                    }
                                }
                                
                                if is_root {
                                    target_pid = pid.as_u32();
                                    break; // Encontrou o pai de todos!
                                }
                            }
                        }

                        if target_pid != 0 {
                            println!("🎯 Injetando loopback no processo ROOT {} (PID: {})", app_name, target_pid);
                            std::thread::spawn(move || {
                                let _ = wasapi::initialize_mta(); // Resolve o aviso do terminal
                                if let Ok(mut client) = wasapi::AudioClient::new_application_loopback_client(target_pid, true) {
                                    let format = wasapi::WaveFormat::new(32, 32, &wasapi::SampleType::Float, sample_rate as usize, 2, None);
                                    let stream_mode = wasapi::StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 200000 };
                                    
                                    if client.initialize_client(&format, &wasapi::Direction::Capture, &stream_mode).is_ok() {
                                        if let Ok(h_event) = client.set_get_eventhandle() {
                                            if let Ok(capture_client) = client.get_audiocaptureclient() {
                                                client.start_stream().ok();
                                                
                                                let mut data_floats = vec![0.0f32; 8192]; 

                                                loop {
                                                    if h_event.wait_for_event(1000).is_err() { break; }
                                                    let mut channel_closed = false;
                                                    
                                                    let data_bytes = unsafe {
                                                        std::slice::from_raw_parts_mut(data_floats.as_mut_ptr() as *mut u8, data_floats.len() * 4)
                                                    };
                                                    
                                                    if let Ok((frames_read, _buffer_info)) = capture_client.read_from_device(data_bytes) {
                                                        let amostras_lidas = (frames_read as usize) * 2; 
                                                        
                                                        if amostras_lidas > 0 && amostras_lidas <= data_floats.len() {
                                                            for &sample in &data_floats[..amostras_lidas] {
                                                                if audio_tx.send(sample).is_err() {
                                                                    channel_closed = true;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    if channel_closed { 
                                                        println!("🛑 Captura do processo encerrada.");
                                                        break; 
                                                    }
                                                }
                                                client.stop_stream().ok();
                                            }
                                        }
                                    } else {
                                        eprintln!("Falha ao inicializar o cliente de áudio do app.");
                                    }
                                } else {
                                    eprintln!("Falha ao criar o cliente loopback (Permissão ou PID inválido).");
                                }
                            });
                        } else {
                            eprintln!("Erro: App {} não encontrado ativo.", app_name);
                        }

                    } else {
                        let real_input_name = if is_loopback { input_name.replace("[Sistema] ", "") } else { input_name.clone() };
                        let in_device_opt = if is_loopback {
                            host.output_devices().ok().and_then(|mut iter| iter.find(|x| x.name().unwrap_or_default() == real_input_name))
                        } else {
                            host.input_devices().ok().and_then(|mut iter| iter.find(|x| x.name().unwrap_or_default() == real_input_name))
                        };

                        if let Some(in_device) = in_device_opt {
                            let in_config_result = if is_loopback { in_device.default_output_config() } else { in_device.default_input_config() };
                            if let Ok(in_config) = in_config_result {
                                let input_stream = in_device.build_input_stream(
                                    &in_config.config(),
                                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                                        for &sample in data { let _ = audio_tx.send(sample); }
                                    },
                                    |err| eprintln!("Erro captação: {}", err),
                                    None,
                                );
                                if let Ok(in_s) = input_stream {
                                    in_s.play().ok();
                                    input_stream_opt = Some(in_s); 
                                }
                            }
                        }
                    }

                    if let Some(out_device) = out_device_opt {
                        if let Ok(out_config) = out_device.default_output_config() {
                            let output_stream = out_device.build_output_stream(
                                &out_config.config(),
                                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                                    let i_vol = input_vol.load();
                                    let o_vol = output_vol.load();
                                    
                                    for sample in data.iter_mut() {
                                        let raw_sample = audio_rx.try_recv().unwrap_or(0.0);
                                        *sample = raw_sample * i_vol * o_vol;
                                    }
                                },
                                |err| eprintln!("Erro reprodução: {}", err),
                                None,
                            );

                            if let Ok(out_s) = output_stream {
                                if out_s.play().is_ok() {
                                    active_connections.insert(conn_id, (input_stream_opt, out_s));
                                    println!("🎵 SUCESSO! Conectado: {} e {}", input_name, output_name);
                                }
                            }
                        }
                    }
                },
                AudioCommand::Disconnect { input_name, output_name } => {
                    let conn_id = format!("{}==>{}", input_name, output_name);
                    if active_connections.remove(&conn_id).is_some() {
                        println!("✂️ CABO CORTADO: {} e {}", input_name, output_name);
                    }
                }
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            tx: Mutex::new(tx),
            volumes: Mutex::new(HashMap::new()), 
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_audio_devices, connect_audio_stream, disconnect_audio_stream, set_device_volume, get_active_apps])
        .run(tauri::generate_context!())
        .expect("Erro Tauri");
}
