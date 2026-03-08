import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

type DeviceNodeData = Node<{
  label: string;
  deviceType: "Input" | "Output" | "App";
}>;

const sliderStyle = {
  width: '100%',
  accentColor: '#00e5ff',
  marginTop: '10px',
  cursor: 'grab', 
  height: '6px', 
};

const nodeStyle = {
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '15px',
  minWidth: '220px', 
  color: 'white',
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
  textAlign: 'left' as const
};

export default function DeviceNode({ data, isConnectable }: NodeProps<DeviceNodeData>) {
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    invoke("set_device_volume", {
      deviceName: data.label,
      volume: volume,
      isMuted: isMuted
    }).catch(console.error);
  }, [volume, isMuted, data.label]);

  const isInput = data.deviceType === 'Input';
  const isApp = data.deviceType === 'App';
  
  const accentColor = isApp ? '#00E676' : (isInput ? '#ff4081' : '#00e5ff');
  
  let icon = '🔊';
  if (isInput) icon = '🎤';
  if (isApp) icon = '📱';

  const showRightHandle = isInput || isApp;
  const showLeftHandle = data.deviceType === 'Output';

  return (
    <div style={{ ...nodeStyle, borderTop: `4px solid ${accentColor}` }}>
      {showLeftHandle && (
        <Handle 
          type="target" 
          position={Position.Left} 
          isConnectable={isConnectable} 
          style={{ background: accentColor, width: 16, height: 16, border: '2px solid #1e1e1e', left: -8 }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '15px', maxWidth: '150px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {data.label}
        </strong>
        <span style={{ fontSize: '20px' }}>{icon}</span>
      </div>

      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px', fontWeight: 'bold' }}>
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
          className="nodrag" 
          style={{ ...sliderStyle, accentColor }}
        />
      </div>

      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="nodrag" 
        style={{
          marginTop: '15px',
          background: isMuted ? '#ff4444' : '#333',
          border: isMuted ? '1px solid #ff4444' : '1px solid #555',
          color: 'white',
          width: '100%',
          padding: '10px', 
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {isMuted ? 'UNMUTE' : 'MUTE'}
      </button>

      {showRightHandle && (
        <Handle 
          type="source" 
          position={Position.Right} 
          isConnectable={isConnectable} 
          style={{ background: accentColor, width: 16, height: 16, border: '2px solid #1e1e1e', right: -8 }}
        />
      )}
    </div>
  );
}