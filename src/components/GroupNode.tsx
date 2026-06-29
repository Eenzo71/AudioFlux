import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { useState } from 'react';

type GroupNodeData = Node<{
  label: string;
  color: string;
}>;

export default function GroupNode({ data, isConnectable }: NodeProps<GroupNodeData>) {
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div style={{
      width: '100%', height: '100%',
      minWidth: '280px',
      background: 'rgba(30, 30, 30, 0.4)',
      border: `2px dashed ${data.color}`,
      borderRadius: '12px',
      padding: '10px',
      display: 'flex', flexDirection: 'column'
    }}>
      <Handle 
        type="target" position={Position.Left} isConnectable={isConnectable} 
        style={{ background: data.color, width: 16, height: 16, left: -9, top: 28 }} 
      />
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        background: '#111', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${data.color}`
      }}>
        <strong style={{ color: 'white', fontSize: '16px' }}>{data.label}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="range" min="0" max="100" value={volume} disabled={isMuted}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ width: '80px', accentColor: data.color }}
          />
          <button 
            onClick={() => setIsMuted(!isMuted)}
            style={{ 
              background: isMuted ? '#ff4444' : '#333', color: 'white', 
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', padding: '4px 8px'
            }}
          >
            {isMuted ? 'M' : 'U'}
          </button>
        </div>
      </div>
      <Handle 
        type="source" position={Position.Right} isConnectable={isConnectable} 
        style={{ background: data.color, width: 16, height: 16, right: -9, top: 28 }} 
      />
    </div>
  );
}