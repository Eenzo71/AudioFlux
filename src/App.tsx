import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface AudioDevice {
  name: String;
  device_type: String;
}

function App() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    async function fetchDevices() {
      try {
        console.log("Chamando o Rust...");
        const result = await invoke<AudioDevice[]>("get_audio_devices");
        console.log("Rust respondeu:", result);
        setDevices(result);
      } catch (error) {
        console.error("Erro ao buscar dispositivos:", error);
      }
    }

    fetchDevices();
  }, []);

  return (
    <div className="container">
      <h1>🎛️ AudioFlux 1.14</h1>
      
      <div className="device-list">
        <h2>Meus Dispositivos:</h2>
        
        {devices.length === 0 ? (
          <p>Carregando ou nenhum dispositivo encontrado...</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {devices.map((dev, index) => (
              <li key={index} style={{ 
                background: "#333", 
                margin: "10px", 
                padding: "10px", 
                borderRadius: "8px",
                borderLeft: dev.device_type === "Input" ? "5px solid #ff4081" : "5px solid #00e5ff"
              }}>
                <strong>{dev.device_type === "Input" ? "🎤 Mic" : "🔊 Som"}:</strong> {dev.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;