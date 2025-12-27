import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useState, useEffect } from 'react'; // Adicionei useEffect
import { invoke } from "@tauri-apps/api/core";

type DeviceNodeData = Node<{
  label: string;
  deviceType: "Input" | "Output";
}>;

const sliderStyle = {
  width: '100%',
  accentColor: '#00e5ff',
  marginTop: '10px',
  cursor: 'pointer'
};

const nodeStyle = {
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '15px',
  minWidth: '200px',
  color: 'white',
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
  textAlign: 'left' as const
};

export default function DeviceNode({ data, isConnectable }: NodeProps<DeviceNodeData>) {
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  // Estado para saber se o usuário está arrastando o slider (para não "brigar" com a atualização automática)
  const [isDragging, setIsDragging] = useState(false);

  const isInput = data.deviceType === 'Input';
  const accentColor = isInput ? '#ff4081' : '#00e5ff';

  // === O SEGREDO DO ESPELHO MÁGICO ===
  // A cada 1 segundo, pergunta pro Rust qual o volume real
  useEffect(() => {
    const interval = setInterval(() => {
      // Só atualiza se o usuário NÃO estiver mexendo no slider agora
      if (!isDragging) {
        invoke<number>("get_device_volume", { 
          name: data.label, 
          isInput: isInput 
        }).then((realVolume) => {
          // O Rust pode retornar algo quebrado as vezes, então garantimos que é número
          if (typeof realVolume === 'number') {
            setVolume(Math.round(realVolume));
          }
        }).catch(console.error);
      }
    }, 1000); // 1000ms = 1 segundo

    // Limpa o timer quando o componente some
    return () => clearInterval(interval);
  }, [data.label, isInput, isDragging]);

  return (
    <div style={{ ...nodeStyle, borderTop: `4px solid ${accentColor}` }}>
      {!isInput && (
        <Handle 
          type="target" 
          position={Position.Left} 
          isConnectable={isConnectable} 
          style={{ background: accentColor, width: 12, height: 12 }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '14px', maxWidth: '140px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {data.label}
        </strong>
        <span style={{ fontSize: '18px' }}>{isInput ? '🎤' : '🔊'}</span>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
          <span>VOL</span>
          <span>{isMuted ? 'MUTE' : `${volume}%`}</span>
        </div>
        
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          disabled={isMuted}
          // Avisa que começou a mexer
          onMouseDown={() => setIsDragging(true)}
          // Avisa que soltou
          onMouseUp={() => setIsDragging(false)}
          onChange={(e) => {
            const newVol = Number(e.target.value);
            setVolume(newVol);
            
            invoke("set_device_volume", { 
              name: data.label, 
              volume: newVol, 
              isInput: isInput 
            }).catch(console.error);
          }}
          style={{ ...sliderStyle, accentColor }}
        />
      </div>

      <button 
        onClick={() => setIsMuted(!isMuted)}
        style={{
          marginTop: '10px',
          background: isMuted ? '#ff4444' : '#333',
          border: 'none',
          color: 'white',
          width: '100%',
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 'bold',
          transition: '0.2s'
        }}
      >
        {isMuted ? 'UNMUTE' : 'MUTE'}
      </button>

      {isInput && (
        <Handle 
          type="source" 
          position={Position.Right} 
          isConnectable={isConnectable} 
          style={{ background: accentColor, width: 12, height: 12 }}
        />
      )}
    </div>
  );
}