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
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;

use std::io::Cursor;
use base64::{Engine as _, engine::general_purpose};
use image::RgbaImage;
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGFI_ICON, SHGFI_LARGEICON, SHFILEINFOW};
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, CreateCompatibleDC, CreateCompatibleBitmap, SelectObject, 
    GetDIBits, DeleteObject, DeleteDC, BITMAPINFO, BITMAPINFOHEADER, 
    BI_RGB, DIB_RGB_COLORS
};

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
    icon_base64: Option<String>,
}

fn get_icon_base64(pid: u32, sys: &System) -> Option<String> {
    unsafe {
        let process = sys.process(Pid::from_u32(pid))?;
        let exe_path = process.exe()?.as_os_str().to_str()?;
        
        let mut path_wide: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut shfi: SHFILEINFOW = std::mem::zeroed();

       if SHGetFileInfoW(
            windows::core::PCWSTR(path_wide.as_ptr()), 
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi as *mut _), 
            std::mem::size_of::<SHFILEINFOW>() as u32, 
            SHGFI_ICON | SHGFI_LARGEICON
        ) != 0 {
            let hicon = shfi.hIcon;
            if hicon.is_invalid() { return None; }

            let width = 32;
            let height = 32;
            
            let dc = GetDC(None);
            let mem_dc = CreateCompatibleDC(dc);
            let bitmap = CreateCompatibleBitmap(dc, width, height);
            let old_obj = SelectObject(mem_dc, bitmap);

            let _ = windows::Win32::UI::WindowsAndMessaging::DrawIconEx(
                mem_dc, 0, 0, hicon, width, height, 0, None, 
                windows::Win32::UI::WindowsAndMessaging::DI_NORMAL
            );

            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = width;
            bi.bmiHeader.biHeight = -height;
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            bi.bmiHeader.biCompression = BI_RGB.0;

            let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];
            
            GetDIBits(mem_dc, bitmap, 0, height as u32, Some(pixels.as_mut_ptr() as *mut _), &mut bi, DIB_RGB_COLORS);

            SelectObject(mem_dc, old_obj);
            DeleteObject(bitmap);
            DeleteDC(mem_dc);
            ReleaseDC(None, dc);
            DestroyIcon(hicon);

            for chunk in pixels.chunks_mut(4) {
                let b = chunk[0];
                let r = chunk[2];
                chunk[0] = r;
                chunk[2] = b;
            }

            if let Some(img_buffer) = RgbaImage::from_raw(width as u32, height as u32, pixels) {
                let mut png_data = Vec::new();
                let mut cursor = Cursor::new(&mut png_data);
                if img_buffer.write_to(&mut cursor, image::ImageOutputFormat::Png).is_ok() {
                    return Some(general_purpose::STANDARD.encode(png_data));
                }
            }
        }
    }
    None
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
                                                let raw_name = process.name().to_string();
                                                let clean_name = raw_name.replace(".exe", "").replace(".EXE", "");
                                                let mut chars = clean_name.chars();
                                                match chars.next() {
                                                    None => String::new(),
                                                    Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                                                }
                                            } else {
                                                format!("App ID {}", pid)
                                            };

                                            let icon = get_icon_base64(pid, &sys);

                                            if let Ok(simple_volume) = session_control.cast::<ISimpleAudioVolume>() {
                                                let vol = simple_volume.GetMasterVolume().unwrap_or(1.0);
                                                let muted = simple_volume.GetMute().map(|b| bool::from(b)).unwrap_or(false);

                                                sessions_list.push(AppSession {
                                                    pid,
                                                    name: process_name,
                                                    volume: vol * 100.0,
                                                    is_muted: muted,
                                                    icon_base64: icon,
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