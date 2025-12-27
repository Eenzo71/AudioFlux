use tauri::command;
use cpal::traits::{HostTrait, DeviceTrait};
use sysinfo::{Pid, System};
use windows::core::Interface; 

use windows::Win32::Media::Audio::{
    eRender, eCapture, IMMDeviceEnumerator, MMDeviceEnumerator, IMMDevice,
    DEVICE_STATE_ACTIVE, IAudioSessionManager2, IAudioSessionControl,
    IAudioSessionControl2, ISimpleAudioVolume
};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::System::Com::{
    CoInitialize, CoCreateInstance, CLSCTX_ALL, STGM_READ,
};
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;

#[derive(serde::Serialize)]
struct AudioDevice {
    name: String,
    device_type: String,
}

#[derive(serde::Serialize)]
struct AppSession {
    pid: u32,
    name: String,
    volume: f32,
    is_muted: bool,
}

#[command]
fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    let host = cpal::default_host();
    let mut devices_list = Vec::new();

    if let Ok(outputs) = host.output_devices() {
        for device in outputs {
            if let Ok(name) = device.name() {
                devices_list.push(AudioDevice { name, device_type: "Output".to_string() });
            }
        }
    }
    if let Ok(inputs) = host.input_devices() {
        for device in inputs {
            if let Ok(name) = device.name() {
                devices_list.push(AudioDevice { name, device_type: "Input".to_string() });
            }
        }
    }
    Ok(devices_list)
}

#[command]
fn get_audio_sessions() -> Result<Vec<AppSession>, String> {
    let mut sessions_list = Vec::new();
    let mut sys = System::new_all();
    sys.refresh_all();

    unsafe {
        let _ = CoInitialize(None);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;

        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| e.to_string())?;

        let count = collection.GetCount().unwrap_or(0);

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
                    if let Ok(session_enum) = session_manager.GetSessionEnumerator() {
                        let session_count = session_enum.GetCount().unwrap_or(0);

                        for j in 0..session_count {
                            if let Ok(session_control) = session_enum.GetSession(j) {
                                if let Ok(session_control2) = session_control.cast::<IAudioSessionControl2>() {
                                    if let Ok(pid) = session_control2.GetProcessId() {
                                        if pid > 0 {
                                            let process_name = if let Some(process) = sys.process(Pid::from_u32(pid)) {
                                                process.name().to_string()
                                            } else {
                                                format!("App ID {}", pid)
                                            };

                                            if let Ok(simple_volume) = session_control.cast::<ISimpleAudioVolume>() {
                                                let vol = simple_volume.GetMasterVolume().unwrap_or(1.0);
                                                let muted = simple_volume.GetMute().map(|b| bool::from(b)).unwrap_or(false); // .into() converte BOOL do windows pra bool do Rust

                                                sessions_list.push(AppSession {
                                                    pid,
                                                    name: process_name,
                                                    volume: vol * 100.0,
                                                    is_muted: muted,
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
    sessions_list.sort_by(|a, b| a.pid.cmp(&b.pid));
    sessions_list.dedup_by(|a, b| a.pid == b.pid);

    Ok(sessions_list)
}

#[command]
fn set_app_volume(pid: u32, volume: f32) -> Result<(), String> {
    unsafe {
        let _ = CoInitialize(None);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;

        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| e.to_string())?;
        let count = collection.GetCount().unwrap_or(0);

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
                    if let Ok(session_enum) = session_manager.GetSessionEnumerator() {
                        let session_count = session_enum.GetCount().unwrap_or(0);
                        for j in 0..session_count {
                            if let Ok(session_control) = session_enum.GetSession(j) {
                                if let Ok(session_control2) = session_control.cast::<IAudioSessionControl2>() {
                                    if let Ok(session_pid) = session_control2.GetProcessId() {
                                        if session_pid == pid {
                                            if let Ok(simple_volume) = session_control.cast::<ISimpleAudioVolume>() {
                                                let _ = simple_volume.SetMasterVolume(volume / 100.0, std::ptr::null());
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
    Ok(())
}

#[command]
fn get_device_volume(name: String, is_input: bool) -> Result<f32, String> {
    unsafe {
        let _ = CoInitialize(None);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;

        let data_flow = if is_input { eCapture } else { eRender };
        let collection = enumerator.EnumAudioEndpoints(data_flow, DEVICE_STATE_ACTIVE)
            .map_err(|e| e.to_string())?;

        let count = collection.GetCount().map_err(|e| e.to_string())?;

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
                    if let Ok(prop_variant) = store.GetValue(&PKEY_Device_FriendlyName) {
                        if let Ok(pwsz) = PropVariantToStringAlloc(&prop_variant) {
                            let device_name_windows = pwsz.to_string().unwrap_or_default();
                            
                            if device_name_windows.contains(&name) || name.contains(&device_name_windows) {
                                if let Ok(endpoint_volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                                    if let Ok(vol) = endpoint_volume.GetMasterVolumeLevelScalar() {
                                        return Ok(vol * 100.0);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(0.0)
}

#[command]
fn set_device_volume(name: String, volume: f32, is_input: bool) -> Result<(), String> {
    unsafe {
        let _ = CoInitialize(None);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;

        let data_flow = if is_input { eCapture } else { eRender };
        let collection = enumerator.EnumAudioEndpoints(data_flow, DEVICE_STATE_ACTIVE)
            .map_err(|e| e.to_string())?;

        let count = collection.GetCount().map_err(|e| e.to_string())?;

        for i in 0..count {
            if let Ok(device) = collection.Item(i) {
                if let Ok(store) = device.OpenPropertyStore(STGM_READ) {
                    if let Ok(prop_variant) = store.GetValue(&PKEY_Device_FriendlyName) {
                        if let Ok(pwsz) = PropVariantToStringAlloc(&prop_variant) {
                            let device_name_windows = pwsz.to_string().unwrap_or_default();
                            
                            if device_name_windows.contains(&name) || name.contains(&device_name_windows) {
                                if let Ok(endpoint_volume) = device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) {
                                    let scalar = volume / 100.0;
                                    let _ = endpoint_volume.SetMasterVolumeLevelScalar(scalar, std::ptr::null());
                                    break; 
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_audio_devices, 
            get_audio_sessions,
            set_app_volume,
            get_device_volume, 
            set_device_volume
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}