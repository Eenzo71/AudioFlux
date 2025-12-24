import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useState } from 'react';

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
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  const isInput = data.deviceType === 'Input';
  
  const accentColor = isInput ? '#ff4081' : '#00e5ff';

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

      {/* Cabeça do Card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '14px', maxWidth: '140px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {data.label}
        </strong>
        {/* Ícone simples  */}
        <span style={{ fontSize: '18px' }}>{isInput ? '🎤' : '🔊'}</span>
      </div>

      {/* Slider de Volume */}
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
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ ...sliderStyle, accentColor }}
        />
      </div>

      {/* Botão de Mute */}
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

      {/* Tomada de Saída*/}
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