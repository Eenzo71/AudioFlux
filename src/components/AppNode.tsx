import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useState } from 'react';
import { invoke } from "@tauri-apps/api/core";

// Define os dados que esse nó recebe
type AppNodeData = Node<{
  label: string;
  pid: number; // O ID do processo (Fundamental para o Rust saber quem é quem)
  initialVolume: number;
}>;

const sliderStyle = {
  width: '100%',
  accentColor: '#d500f9', // Roxo Neon
  marginTop: '10px',
  cursor: 'pointer'
};

const nodeStyle = {
  background: '#121212', // Um pouco mais escuro que o normal
  border: '1px solid #333',
  borderRadius: '12px',
  padding: '15px',
  minWidth: '200px',
  color: 'white',
  boxShadow: '0 0 15px rgba(213, 0, 249, 0.2)', // Brilho Roxo
  textAlign: 'left' as const
};

export default function AppNode({ data, isConnectable }: NodeProps<AppNodeData>) {
  // Inicializa com o volume que veio do Rust
  const [volume, setVolume] = useState(data.initialVolume || 100);
  
  return (
    <div style={{ ...nodeStyle, borderTop: `4px solid #d500f9` }}>
      {/* Apps geralmente são "Geradores" de som, então saída na direita */}
      <Handle 
        type="source" 
        position={Position.Right} 
        isConnectable={isConnectable} 
        style={{ background: '#d500f9', width: 12, height: 12 }}
      />

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '14px', maxWidth: '140px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {data.label}
        </strong>
        <span style={{ fontSize: '16px' }}>🎵</span>
      </div>

      {/* ID do Processo (Estilo Hacker) */}
      <div style={{ fontSize: '9px', color: '#666', marginTop: '2px', fontFamily: 'monospace' }}>
        PID: {data.pid}
      </div>

      {/* Slider */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
          <span>APP VOL</span>
          <span>{`${Math.round(volume)}%`}</span>
        </div>
        
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => {
            const newVol = Number(e.target.value);
            setVolume(newVol);
            
            // CHAMA O COMANDO NOVO DE APPS
            invoke("set_app_volume", { 
              pid: data.pid, 
              volume: newVol 
            }).catch(console.error);
          }}
          style={sliderStyle}
        />
      </div>
    </div>
  );
}